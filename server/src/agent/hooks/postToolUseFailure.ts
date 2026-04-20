import type { HookCallbackMatcher, PostToolUseFailureHookInput } from "@anthropic-ai/claude-agent-sdk";
import type { LoopState } from "../handlers/turnUsage";
import type { SessionState } from "../../state";
import { send } from "../../ws/send";
import { buildToolCall } from "./toolCallHelpers";

export function makePostToolUseFailureHook(
  session: SessionState,
  sessionId: string,
  loopState: LoopState
): HookCallbackMatcher {
  return {
    hooks: [
      async (input) => {
        const msg = input as PostToolUseFailureHookInput;
        const error = typeof msg.error === "string" ? msg.error : JSON.stringify(msg.error);
        const toolCall = buildToolCall(msg, session, sessionId, loopState, error);

        send({ type: "tool_call", session_id: sessionId, tool_call: toolCall });

        return { continue: true };
      },
    ],
  };
}
