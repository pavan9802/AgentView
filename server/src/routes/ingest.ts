import type { AgentToServer } from "@agentview/shared";
import { processAgentEvent } from "../agent/ingest";

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
    const approved = await approvalPromise;
    return new Response(JSON.stringify({ approved }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  processAgentEvent(msg);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
