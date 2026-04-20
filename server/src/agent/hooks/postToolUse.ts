import type { HookCallbackMatcher, PostToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";
import type { LoopState } from "../handlers/turnUsage";
import type { SessionState } from "../../state";
import { send } from "../../ws/send";
import { buildToolCall } from "./toolCallHelpers";

export function makePostToolUseHook(
  session: SessionState,
  sessionId: string,
  loopState: LoopState
): HookCallbackMatcher {
  return {
    hooks: [
      async (input) => {
        const msg = input as PostToolUseHookInput;
        const toolCall = buildToolCall(msg, session, sessionId, loopState, null);

        send({ type: "tool_call", session_id: sessionId, tool_call: toolCall });

        const output =
          typeof msg.tool_response === "string"
            ? msg.tool_response
            : JSON.stringify(msg.tool_response);

        send({ type: "tool_result", session_id: sessionId, tool_call_id: toolCall.id, output });

        return { continue: true };
      },
    ],
  };
}
