import type { ToolCall } from "@agentview/shared";
import type { LoopState } from "../handlers/turnUsage";
import type { SessionState } from "../../state";

export function buildToolCall(
  msg: { tool_use_id: string; tool_name: string; tool_input: unknown },
  session: SessionState,
  sessionId: string,
  loopState: LoopState,
  error: string | null,
): ToolCall {
  const duration_ms = Date.now() - (loopState.toolTimestamps.get(msg.tool_use_id) ?? Date.now());
  loopState.toolTimestamps.delete(msg.tool_use_id);

  const wasApprovalRequired = session.approvalRequiredTools.has(msg.tool_name);
  const approved = wasApprovalRequired ? session.approvedToolUseIds.has(msg.tool_use_id) : null;
  if (wasApprovalRequired) session.approvedToolUseIds.delete(msg.tool_use_id);

  return {
    id: msg.tool_use_id,
    session_id: sessionId,
    turn_id: loopState.currentTurnId,
    tool_name: msg.tool_name,
    tool_input: JSON.stringify(msg.tool_input),
    duration_ms,
    approved,
    error,
    created_at: Date.now(),
  };
}
