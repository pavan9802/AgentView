import type { AgentToServer } from "@agentview/shared";
import { agentConnections, sessions, pendingApprovals, pendingApprovalDetails } from "../state";
import { send } from "./send";
import { processAgentEvent } from "../agent/ingest";

export function handleAgentWsOpen(_ws: BunServerWebSocket): void {
  // session_started message will register the connection in agentConnections
}

export function handleAgentWsMessage(ws: BunServerWebSocket, data: string | Uint8Array): void {
  let msg: AgentToServer;
  try {
    msg = JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data)) as AgentToServer;
  } catch {
    return;
  }

  if (!msg || typeof msg.type !== "string") return;

  processAgentEvent(msg, ws);
}

export function handleAgentWsClose(ws: BunServerWebSocket): void {
  for (const [sessionId, conn] of agentConnections) {
    if (conn !== ws) continue;

    agentConnections.delete(sessionId);

    const s = sessions.get(sessionId);
    if (s && s.status === "running") {
      s.status = "errored";
      s.completed_at = Date.now();
      s.error_type = "api_unavailable";
      s.error_message = "Agent disconnected unexpectedly";

      // Drain any pending approvals for this session so HTTP long-polls don't hang.
      for (const [id, resolve] of pendingApprovals) {
        const details = pendingApprovalDetails.get(id);
        if (details?.session_id === sessionId) {
          pendingApprovals.delete(id);
          pendingApprovalDetails.delete(id);
          resolve(false);
        }
      }

      send({
        type: "session_errored",
        session_id: sessionId,
        error_type: "api_unavailable",
        error_message: "Agent disconnected unexpectedly",
      });
    }
    break;
  }
}
