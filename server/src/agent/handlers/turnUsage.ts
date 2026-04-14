import type { Turn } from "@agentview/shared";
import type { SessionState } from "../../state";
import { send } from "../../ws/send";

// Haiku 4.5 pricing (per token)
const COST_PER_INPUT_TOKEN = 1e-6;   // $1 / 1M
const COST_PER_OUTPUT_TOKEN = 5e-6;  // $5 / 1M

export type LoopState = {
  turnStartedAt: number;
  turnNumber: number;
  currentTurnId: string;
  toolTimestamps: Map<string, number>;
};

export function handleTurnUsage(
  message: unknown,
  session: SessionState,
  sessionId: string,
  loopState: LoopState,
): void {
  if (typeof message !== "object" || message === null || !("usage" in message)) return;

  const usage = (message as { usage: unknown }).usage;
  if (typeof usage !== "object" || usage === null) return;

  const { input_tokens, output_tokens } = usage as { input_tokens?: number; output_tokens?: number };
  const inputTok = input_tokens ?? 0;
  const outputTok = output_tokens ?? 0;
  const latency_ms = Date.now() - loopState.turnStartedAt;
  const cost_usd = inputTok * COST_PER_INPUT_TOKEN + outputTok * COST_PER_OUTPUT_TOKEN;
  const context_fill_pct = Math.min((inputTok / 200_000) * 100, 100);

  loopState.turnNumber += 1;

  const turn: Turn = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    turn_number: loopState.turnNumber,
    input_tokens: inputTok,
    output_tokens: outputTok,
    cost_usd,
    context_fill_pct,
    latency_ms,
    created_at: Date.now(),
  };
  loopState.currentTurnId = turn.id;

  session.total_tokens += inputTok + outputTok;
  session.total_cost_usd += cost_usd;
  session.total_turns = loopState.turnNumber;

  send({
    type: "turn_update",
    session_id: sessionId,
    turn,
    cumulative_cost_usd: session.total_cost_usd,
    cumulative_tokens: session.total_tokens,
  });

  loopState.turnStartedAt = Date.now();
}
