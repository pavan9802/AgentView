import type { HookCallbackMatcher, SessionStartHookInput } from "@anthropic-ai/claude-agent-sdk";
import type { AgentViewSessionState } from "../../state";

export function makeSessionStartHook(
  session: AgentViewSessionState,
  sessionId: string,
  isResume: boolean,
): HookCallbackMatcher {
  return {
    hooks: [
      async (input) => {
        const msg = input as SessionStartHookInput;
        session.sdk_session_id = msg.session_id;
        console.log(`[session:${sessionId}] ${isResume ? "confirmed" : "captured"} sdk_session_id: ${msg.session_id} (source: ${msg.source})`);
        return { continue: true };
      },
    ],
  };
}
