import { client, setClient } from "../state";

export function handleWsOpen(ws: BunServerWebSocket): void {
  // Evict any existing connection — single-connection semantics.
  if (client) {
    client.close(1000, "Replaced by new connection");
  }
  setClient(ws);
}

export function handleWsMessage(_ws: BunServerWebSocket, _data: string | Uint8Array): void {
  // TODO: implement (3.4)
}

export function handleWsClose(ws: BunServerWebSocket): void {
  if (client === ws) {
    setClient(null);
  }
}
