import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Turn } from "@agentview/shared";
import { sessions } from "../state";
import { send } from "../ws/send";

// Haiku 4.5 pricing (per token)
const COST_PER_INPUT_TOKEN = 1e-6;   // $1 / 1M
const COST_PER_OUTPUT_TOKEN = 5e-6;  // $5 / 1M

export async function runAgentSession(sessionId: string, prompt?: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  const isResume = prompt !== undefined;
  const turnPrompt = isResume ? prompt : session.prompt;

  session.status = "running";
  session.completed_at = null;
  if (!isResume) session.started_at = Date.now();

  console.log(`\n[session:${sessionId}] ${isResume ? "resumed" : "started"} — prompt: "${turnPrompt}"`);

  let turnStartedAt = Date.now();
  let turnNumber = session.total_turns; // preserve count across resumes
  let currentTurnId = "";
  const toolTimestamps = new Map<string, number>();

  try {
    for await (const message of query({
      prompt: turnPrompt,
      options: {
        cwd: session.cwd,
        allowedTools: ["Read", "Glob", "Grep", "Write", "Edit"],
        permissionMode: "acceptEdits",
        model: "claude-haiku-4-5",
        abortController: session.abortController,
        ...(isResume ? { resume: session.sdk_session_id! } : {}),
      },
    })) {
      // Capture the SDK's own session ID from the system:init message.
      // This is what gets passed to query({ options: { resume } }) to resume later.
      if ("type" in message && message.type === "system" &&
          "subtype" in message && message.subtype === "init" &&
          "session_id" in message && typeof message.session_id === "string") {
        session.sdk_session_id = message.session_id;
        console.log(`[session:${sessionId}] ${isResume ? "confirmed" : "captured"} sdk_session_id: ${message.session_id}`);
      }

      // Log every message for observability during development
      console.log(`[session:${sessionId}]`, JSON.stringify(message));

      // Track token usage from assistant messages
      if ("usage" in message && message.usage != null) {
        const usage = message.usage as { input_tokens?: number; output_tokens?: number };
        const inputTok = usage.input_tokens ?? 0;
        const outputTok = usage.output_tokens ?? 0;
        const latency_ms = Date.now() - turnStartedAt;
        const cost_usd = inputTok * COST_PER_INPUT_TOKEN + outputTok * COST_PER_OUTPUT_TOKEN;
        const context_fill_pct = Math.min((inputTok / 200_000) * 100, 100);
        turnNumber += 1;

        const turn: Turn = {
          id: crypto.randomUUID(),
          session_id: sessionId,
          turn_number: turnNumber,
          input_tokens: inputTok,
          output_tokens: outputTok,
          cost_usd,
          context_fill_pct,
          latency_ms,
          created_at: Date.now(),
        };
        currentTurnId = turn.id;

        session.total_tokens += inputTok + outputTok;
        session.total_cost_usd += cost_usd;
        session.total_turns = turnNumber;

        send({
          type: "turn_update",
          session_id: sessionId,
          turn,
          cumulative_cost_usd: session.total_cost_usd,
          cumulative_tokens: session.total_tokens,
        });

        turnStartedAt = Date.now();
      }
    }

    session.status = "complete";
    session.completed_at = Date.now();
    console.log(`[session:${sessionId}] complete — cost: $${session.total_cost_usd.toFixed(4)}, turns: ${session.total_turns}`);
  } catch (err) {
    session.completed_at = Date.now();
    if (err instanceof Error && err.name === "AbortError") {
      // Session was killed externally (kill_session message or shutdown) — don't overwrite status.
      console.log(`[session:${sessionId}] aborted — status: ${session.status}`);
    } else {
      session.status = "errored";
      console.error(`[session:${sessionId}] error`, err);
    }
  }
}
