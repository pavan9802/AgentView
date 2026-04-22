import type { Turn, KillReason } from "@agentview/shared";
import type { CcSessionState, SessionState } from "../../state";
import { pendingApprovals, pendingApprovalDetails } from "../../state";
import { send } from "../../ws/send";
import { getPricing } from "../../lib/pricing";

/**
 * Source-aware session kill. Exported so ws/handler.ts and hook handlers
 * can call a single shared implementation.
 *
 * - agentview: aborts the SDK query loop via AbortController
 * - claude_code: sets killRequested = true; the PreToolUse hook denies at
 *   the next tool call boundary
 *
 * Both paths drain only the pending approvals that belong to this session,
 * fixing B1 (global drain could cancel approvals for other sessions).
 */
export function killSession(session: SessionState, sessionId: string, reason: KillReason): void {
  session.status = "killed";
  session.kill_reason = reason;

  if (session.source === "agentview") {
    session.abortController.abort();
  } else {
    (session as CcSessionState).killRequested = true;
  }

  // Session-scoped approval drain — resolves only entries belonging to this
  // session so concurrent sessions are not disrupted.
  for (const [toolUseId, resolve] of pendingApprovals) {
    const details = pendingApprovalDetails.get(toolUseId);
    if (details?.session_id === sessionId) {
      resolve(false);
      pendingApprovals.delete(toolUseId);
      pendingApprovalDetails.delete(toolUseId);
    }
  }

  send({ type: "session_killed", session_id: sessionId, reason });
}

export type LoopState = {
  turnStartedAt: number;
  turnNumber: number;
  currentTurnId: string;
  toolTimestamps: Map<string, number>;
  resultText: string;
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

  const { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens } =
    usage as { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
  const inputTok = input_tokens ?? 0;
  const outputTok = output_tokens ?? 0;
  const cacheWriteTok = cache_creation_input_tokens ?? 0;
  const cacheReadTok = cache_read_input_tokens ?? 0;
  const latency_ms = Date.now() - loopState.turnStartedAt;
  const pricing = getPricing(session.model);
  const cost_usd =
    inputTok * pricing.input +
    outputTok * pricing.output +
    cacheWriteTok * pricing.cacheWrite +
    cacheReadTok * pricing.cacheRead;
  const context_fill_pct = Math.min((inputTok / 200_000) * 100, 100);

  loopState.turnNumber += 1;

  const turn: Turn = {
    id: loopState.currentTurnId,
    session_id: sessionId,
    turn_number: loopState.turnNumber,
    input_tokens: inputTok,
    output_tokens: outputTok,
    cost_usd,
    context_fill_pct,
    latency_ms,
    created_at: Date.now(),
  };
  loopState.currentTurnId = crypto.randomUUID();

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

  const budgetUsd = parseFloat(process.env["BUDGET_USD"] ?? "0.5");
  if (session.total_cost_usd > budgetUsd) {
    killSession(session, sessionId, "budget_exceeded");
    return;
  }

  const maxTurns = parseInt(process.env["MAX_TURNS"] ?? "50", 10);
  if (loopState.turnNumber > maxTurns) {
    killSession(session, sessionId, "max_turns_exceeded");
    return;
  }

  loopState.turnStartedAt = Date.now();
}
