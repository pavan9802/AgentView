import type { CanUseTool } from "@anthropic-ai/claude-agent-sdk";
import { pendingApprovals, pendingApprovalDetails, type SessionState } from "../../state";
import { send } from "../../ws/send";

export function makeCanUseTool(session: SessionState, sessionId: string): CanUseTool {
  return async (toolName, input, { toolUseID }) => {
    if (!session.approvalRequiredTools.has(toolName)) {
      return { behavior: "allow" };
    }

    send({
      type: "approval_required",
      session_id: sessionId,
      tool_call_id: toolUseID,
      tool_name: toolName,
      tool_input: JSON.stringify(input),
    });

    pendingApprovalDetails.set(toolUseID, { session_id: sessionId, tool_name: toolName, tool_input: JSON.stringify(input) });

    const approved = await new Promise<boolean>((resolve) => {
      pendingApprovals.set(toolUseID, resolve);
      session.abortController.signal.addEventListener("abort", () => {
        pendingApprovals.delete(toolUseID);
        resolve(false);
      }, { once: true });
    });

    pendingApprovalDetails.delete(toolUseID);

    if (approved) {
      session.approvedToolUseIds.add(toolUseID);
      return { behavior: "allow" };
    }
    return { behavior: "deny", message: "User rejected" };
  };
}
