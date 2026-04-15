import type { HookCallbackMatcher, PostToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";
import type { ToolCall } from "@agentview/shared";
import type { LoopState } from "../handlers/turnUsage";
import type { SessionState } from "../../state";
import { send } from "../../ws/send";

export function makePostToolUseHook(
  session: SessionState,
  sessionId: string,
  loopState: LoopState
): HookCallbackMatcher {
  return {
    hooks: [
      async (input) => {
        const msg = input as PostToolUseHookInput;

        const duration_ms = Date.now() - (loopState.toolTimestamps.get(msg.tool_use_id) ?? Date.now());
        loopState.toolTimestamps.delete(msg.tool_use_id);

        const wasApprovalRequired = session.approvalRequiredTools.has(msg.tool_name);
        const approved = wasApprovalRequired
          ? (session.approvedToolUseIds.has(msg.tool_use_id) ? true : false)
          : null;
        if (wasApprovalRequired) session.approvedToolUseIds.delete(msg.tool_use_id);

        const toolCall: ToolCall = {
          id: crypto.randomUUID(),
          session_id: sessionId,
          turn_id: loopState.currentTurnId,
          tool_name: msg.tool_name,
          tool_input: JSON.stringify(msg.tool_input),
          duration_ms,
          approved,
          error: null,
          created_at: Date.now(),
        };

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
