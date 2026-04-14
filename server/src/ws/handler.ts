import type { WsClientToServer } from "@agentview/shared";
import { client, pendingApprovals, sessions, sessionToPublic, setClient } from "../state";
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
      if (session.status !== "running" && session.status !== "created") return;
      session.abortController.abort();
      session.status = "killed";
      session.kill_reason = "user_requested";
      // Drain any pending approval so the canUseTool await unblocks and the
      // SDK loop can observe the abort signal.
      for (const [id, resolve] of pendingApprovals) {
        resolve(false);
        pendingApprovals.delete(id);
      }
      send({ type: "session_killed", session_id: msg.session_id, reason: "user_requested" });
      break;
    }

    case "approval_response": {
      const resolve = pendingApprovals.get(msg.tool_call_id);
      if (!resolve) return;
      pendingApprovals.delete(msg.tool_call_id);
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
