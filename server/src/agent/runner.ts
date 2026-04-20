import { query as realQuery } from "@anthropic-ai/claude-agent-sdk";
import { mockQuery } from "./mockQuery";
import { pendingApprovals, sessions } from "../state";
import { PromptQueue } from "./promptQueue";
import { handleTurnUsage, type LoopState } from "./handlers/turnUsage";
import { makePreToolUseHook } from "./hooks/preToolUse";
import { makePostToolUseHook } from "./hooks/postToolUse";
import { makePostToolUseFailureHook } from "./hooks/postToolUseFailure";
import { makeSessionStartHook } from "./hooks/sessionStart";
import { makeStopHook } from "./hooks/stop";
import { makeCanUseTool } from "./hooks/canUseTool";
import { send } from "../ws/send";

// Use the mock when ANTHROPIC_API_KEY=mock to test the WebSocket pipeline locally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const query = process.env["ANTHROPIC_API_KEY"] === "mock" ? (mockQuery as any as typeof realQuery) : realQuery;

function extractAssistantText(message: unknown): string | null {
  if (typeof message !== "object" || message === null || !("role" in message)) return null;
  const msg = message as { role: unknown; content?: unknown };
  if (msg.role !== "assistant" || !Array.isArray(msg.content)) return null;
  const texts = (msg.content as unknown[])
    .filter((b): b is { type: string; text: string } =>
      typeof b === "object" && b !== null && (b as Record<string, unknown>)["type"] === "text"
    )
    .map((b) => b.text);
  return texts.length > 0 ? texts.join("\n") : null;
}

export async function runAgentSession(sessionId: string, prompt?: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  const isResume = prompt !== undefined;
  const turnPrompt = isResume ? prompt : session.prompt;

  session.status = "running";
  session.completed_at = null;
  session.error_type = null;
  session.error_message = null;
  session.kill_reason = null;
  if (isResume) {
    session.abortController = new AbortController();
    session.result_text = null;
  }
  if (!isResume) session.started_at = Date.now();

  console.log(`\n[session:${sessionId}] ${isResume ? "resumed" : "started"} — prompt: "${turnPrompt}"`);

  const loopState: LoopState = {
    turnStartedAt: Date.now(),
    turnNumber: session.total_turns,
    currentTurnId: crypto.randomUUID(),
    toolTimestamps: new Map(),
    resultText: "",
  };

  const queue = new PromptQueue();
  session.promptQueue = queue;

  try {
    const q = query({
      prompt: turnPrompt,
      options: {
        cwd: session.cwd,
        allowedTools: ["Read", "Glob", "Grep", "Edit", "Bash", "Write"],
        permissionMode: "acceptEdits",
        model: "claude-haiku-4-5",
        abortController: session.abortController,
        hooks: {
          SessionStart: [makeSessionStartHook(session, sessionId, isResume)],
          PreToolUse: [makePreToolUseHook(loopState)],
          PostToolUse: [makePostToolUseHook(session, sessionId, loopState)],
          PostToolUseFailure: [makePostToolUseFailureHook(session, sessionId, loopState)],
          Stop: [makeStopHook(session, sessionId, loopState)],
        },
        canUseTool: makeCanUseTool(session, sessionId),
        ...(isResume ? { resume: session.sdk_session_id! } : {}),
      },
    });

    q.streamInput(queue).catch((err) => {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[session:${sessionId}] streamInput error`, err);
      send({ type: "injection_failed", session_id: sessionId, error });
    });

    for await (const message of q) {
      handleTurnUsage(message, session, sessionId, loopState);

      // Track the last assistant text for the Stop hook to include in session_complete.
      const text = extractAssistantText(message);
      if (text) loopState.resultText = text;

      // Log every message for observability during development
      console.log(`[session:${sessionId}]`, JSON.stringify(message));
    }
  } catch (err) {

    session.completed_at = Date.now();

    if (err instanceof Error && err.name === "AbortError") {
      // Drain any pending approval that may have been left mid-await.
      for (const [id, resolve] of pendingApprovals) {
        resolve(false);
        pendingApprovals.delete(id);
      }
      // Broadcast session_killed only if the kill handler hasn't already done so.
      if (!session.kill_reason) {
        session.status = "killed";
        session.kill_reason = "user_requested";
        send({ type: "session_killed", session_id: sessionId, reason: "user_requested" });
      }
      console.log(`[session:${sessionId}] aborted — status: ${session.status}`);
    } else {
      const message = err instanceof Error ? err.message : String(err);
      session.status = "errored";
      session.error_type = "api_unavailable";
      session.error_message = message;
      send({ type: "session_errored", session_id: sessionId, error_type: "api_unavailable", error_message: message });
      console.error(`[session:${sessionId}] error`, err);
    }
  } finally {
    queue.close();
    session.promptQueue = null;
  }
}
