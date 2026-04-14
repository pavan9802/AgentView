import { query } from "@anthropic-ai/claude-agent-sdk";
import { sessions } from "../state";
import { handleSystemInit } from "./handlers/systemInit";
import { handleTurnUsage, type LoopState } from "./handlers/turnUsage";
import { makePreToolUseHook } from "./hooks/preToolUse";
import { makeCanUseTool } from "./hooks/canUseTool";

export async function runAgentSession(sessionId: string, prompt?: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  const isResume = prompt !== undefined;
  const turnPrompt = isResume ? prompt : session.prompt;

  session.status = "running";
  session.completed_at = null;
  if (!isResume) session.started_at = Date.now();

  console.log(`\n[session:${sessionId}] ${isResume ? "resumed" : "started"} — prompt: "${turnPrompt}"`);

  const loopState: LoopState = {
    turnStartedAt: Date.now(),
    turnNumber: session.total_turns,
    currentTurnId: "",
    toolTimestamps: new Map(),
  };

  try {
    for await (const message of query({
      prompt: turnPrompt,
      options: {
        cwd: session.cwd,
        allowedTools: ["Read", "Glob", "Grep", "Edit"],
        permissionMode: "acceptEdits",
        model: "claude-haiku-4-5",
        abortController: session.abortController,
        hooks: {
          PreToolUse: [makePreToolUseHook(loopState)],
        },
        canUseTool: makeCanUseTool(session, sessionId),
        ...(isResume ? { resume: session.sdk_session_id! } : {}),
      },
    })) {
      handleSystemInit(message, session, sessionId, isResume);
      handleTurnUsage(message, session, sessionId, loopState);

      // Log every message for observability during development
      console.log(`[session:${sessionId}]`, JSON.stringify(message));
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
