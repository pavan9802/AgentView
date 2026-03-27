import { query } from "@anthropic-ai/claude-agent-sdk";
import { sessions } from "../state";

// Haiku 4.5 pricing (per token)
const COST_PER_INPUT_TOKEN = 1e-6;   // $1 / 1M
const COST_PER_OUTPUT_TOKEN = 5e-6;  // $5 / 1M

export async function runAgentSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.status = "running";
  session.started_at = Date.now();

  console.log(`\n[session:${sessionId}] started — prompt: "${session.prompt}"`);

  try {
    for await (const message of query({
      prompt: session.prompt,
      options: {
        cwd: session.cwd,
        allowedTools: ["Read", "Glob", "Grep", "Write", "Edit"],
        permissionMode: "acceptEdits",
        model: "claude-haiku-4-5",
      },
    })) {
      // Capture the SDK's own session ID from the system:init message.
      // This is what gets passed to query({ options: { resume } }) to resume later.
      if ("type" in message && message.type === "system" &&
          "subtype" in message && message.subtype === "init" &&
          "session_id" in message && typeof message.session_id === "string") {
        session.sdk_session_id = message.session_id;
        console.log(`[session:${sessionId}] sdk_session_id: ${message.session_id}`);
      }

      // Log every message for observability during development
      console.log(`[session:${sessionId}]`, JSON.stringify(message));

      // Track token usage from assistant messages
      if ("usage" in message && message.usage != null) {
        const usage = message.usage as { input_tokens?: number; output_tokens?: number };
        const inputTok = usage.input_tokens ?? 0;
        const outputTok = usage.output_tokens ?? 0;
        session.total_tokens += inputTok + outputTok;
        session.total_cost_usd += inputTok * COST_PER_INPUT_TOKEN + outputTok * COST_PER_OUTPUT_TOKEN;
        session.total_turns += 1;
      }
    }

    session.status = "complete";
    session.completed_at = Date.now();
    console.log(`[session:${sessionId}] complete — cost: $${session.total_cost_usd.toFixed(4)}, turns: ${session.total_turns}`);
  } catch (err) {
    session.status = "errored";
    session.completed_at = Date.now();
    console.error(`[session:${sessionId}] error`, err);
  }
}
