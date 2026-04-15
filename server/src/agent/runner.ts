import { query as realQuery } from "@anthropic-ai/claude-agent-sdk";
import { mockQuery } from "./mockQuery";
import { pendingApprovals, sessions } from "../state";
import { handleSystemInit } from "./handlers/systemInit";
import { handleTurnUsage, type LoopState } from "./handlers/turnUsage";
import { makePreToolUseHook } from "./hooks/preToolUse";
import { makePostToolUseHook } from "./hooks/postToolUse";
import { makeCanUseTool } from "./hooks/canUseTool";
import { send } from "../ws/send";

// Use the mock when ANTHROPIC_API_KEY=mock to test the WebSocket pipeline locally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const query = process.env["ANTHROPIC_API_KEY"] === "mock" ? (mockQuery as any as typeof realQuery) : realQuery;

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
    currentTurnId: crypto.randomUUID(),
    toolTimestamps: new Map(),
  };

  let resultText = "";

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
          PostToolUse: [makePostToolUseHook(session, sessionId, loopState)],
        },
        canUseTool: makeCanUseTool(session, sessionId),
        ...(isResume ? { resume: session.sdk_session_id! } : {}),
      },
    })) {
      handleSystemInit(message, session, sessionId, isResume);
      handleTurnUsage(message, session, sessionId, loopState);

      // Track the last assistant text content for result_text
      if (
        typeof message === "object" && message !== null &&
        "role" in message && (message as { role: unknown }).role === "assistant" &&
        "content" in message && Array.isArray((message as { content: unknown }).content)
      ) {
        const content = (message as unknown as { content: unknown[] }).content;
        const texts = content
          .filter((b): b is { type: string; text: string } =>
            typeof b === "object" && b !== null && "type" in b && (b as { type: unknown }).type === "text"
          )
          .map((b) => b.text);
        if (texts.length > 0) resultText = texts.join("\n");
      }

      // Log every message for observability during development
      console.log(`[session:${sessionId}]`, JSON.stringify(message));
    }

    // Guard against the race where budget/max-turns abort fires on the last turn:
    // the SDK generator may have already finished cleanly, so for-await exits
    // normally instead of throwing AbortError. In that case kill_reason is already
    // set and session_killed was already broadcast — don't overwrite.
    if (session.kill_reason === null) {
      session.status = "complete";
      session.completed_at = Date.now();
      session.result_text = resultText;
      send({
        type: "session_complete",
        session_id: sessionId,
        total_cost_usd: session.total_cost_usd,
        total_turns: session.total_turns,
        result_text: resultText,
      });
      console.log(`[session:${sessionId}] complete — cost: $${session.total_cost_usd.toFixed(4)}, turns: ${session.total_turns}`);
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
  }
}
