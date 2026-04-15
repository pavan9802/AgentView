import type { WsClientToServer } from "@agentview/shared";

// Stub — wired in 4.4 with full WebSocket lifecycle
export const wsClient = {
  send(_msg: WsClientToServer): void {
    // no-op until 4.4
  },
};
