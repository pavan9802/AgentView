import type { WsClientToServer } from "@agentview/shared";
import { client, pendingApprovals, pendingApprovalDetails, sessions, sessionToPublic, setClient } from "../state";
import { killSession } from "../agent/handlers/turnUsage";
import { send } from "./send";

export function handleWsOpen(ws: BunServerWebSocket): void {
  // Evict any existing connection — single-connection semantics.
  if (client) {
    client.close(1000, "Replaced by new connection");
  }
  setClient(ws);

  send({
    type: "init",
    sessions: [...sessions.values()]
      .sort((a, b) => b.created_at - a.created_at)
      .map(sessionToPublic),
    turns: [],
    tool_calls: [],
    pending_approvals: [...pendingApprovalDetails.entries()].map(([tool_call_id, details]) => ({
      tool_call_id,
      session_id: details.session_id,
      tool_name: details.tool_name,
      tool_input: details.tool_input,
    })),
    key_status: "unknown",
    sync_status: { pending_rows: 0, last_sync_at: null, is_reachable: false },
  });
}

export function handleWsMessage(_ws: BunServerWebSocket, data: string | Uint8Array): void {
  let msg: WsClientToServer;
  try {
    msg = JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data)) as WsClientToServer;
  } catch {
    return; // malformed JSON — drop silently
  }

  if (!msg || typeof msg.type !== "string") return;

  switch (msg.type) {
    case "kill_session": {
      const session = sessions.get(msg.session_id);
      if (!session) return;
      if (session.status !== "running") return;
      killSession(session, msg.session_id, "user_requested");
      break;
    }

    case "approval_response": {
      const resolve = pendingApprovals.get(msg.tool_call_id);
      if (!resolve) return;
      pendingApprovals.delete(msg.tool_call_id);
      pendingApprovalDetails.delete(msg.tool_call_id);
      resolve(msg.approved);
      break;
    }

    case "set_approval_config": {
      const session = sessions.get(msg.session_id);
      if (!session) break;
      session.approvalRequiredTools = new Set(msg.approval_required_tools);
      break;
    }
  }
}

export function handleWsClose(ws: BunServerWebSocket): void {
  if (client === ws) {
    setClient(null);
  }
}
