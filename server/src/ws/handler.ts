import { client, sessions, sessionToPublic, setClient } from "../state";
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

export function handleWsMessage(_ws: BunServerWebSocket, _data: string | Uint8Array): void {
  // TODO: implement (3.4)
}

export function handleWsClose(ws: BunServerWebSocket): void {
  if (client === ws) {
    setClient(null);
  }
}
