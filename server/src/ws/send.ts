import type { WsServerToClient } from "@agentview/shared";
import { client, setClient } from "../state";

/**
 * Serialise msg to JSON and send to the connected dashboard.
 * Clears the client reference if the send fails (dead socket).
 */
export function send(msg: WsServerToClient): void {
  if (!client) return;
  try {
    client.send(JSON.stringify(msg));
  } catch {
    setClient(null);
  }
}
