import type { AgentToServer } from "@agentview/shared";
import { processAgentEvent } from "../agent/ingest";
import { pendingApprovals, pendingApprovalDetails } from "../state";

export async function handlePostIngest(req: Request): Promise<Response> {
  let msg: AgentToServer;
  try {
    msg = (await req.json()) as AgentToServer;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body", code: "invalid_request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!msg || typeof msg.type !== "string") {
    return new Response(JSON.stringify({ error: "Missing event type", code: "invalid_request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // approval_required is synchronous: we long-poll until the dashboard responds.
  if (msg.type === "approval_required") {
    const approvalPromise = processAgentEvent(msg);
    if (!approvalPromise) {
      return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
    }
    // Timeout after 5 minutes — fail open so the agent isn't blocked forever if the
    // dashboard disconnects or the user walks away.
    const toolCallId = msg.tool_call_id;
    let timedOut = false;
    const timeout = new Promise<boolean>((resolve) => setTimeout(() => { timedOut = true; resolve(true); }, 5 * 60 * 1000));
    const approved = await Promise.race([approvalPromise, timeout]);
    // If the timeout won, the pendingApprovals callback was never called, so
    // pendingApprovalDetails still has this entry. Clean it up now so the
    // dashboard init message doesn't include a stale pending approval.
    if (timedOut) {
      pendingApprovals.delete(toolCallId);
      pendingApprovalDetails.delete(toolCallId);
    }
    return new Response(JSON.stringify({ approved }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  processAgentEvent(msg);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
