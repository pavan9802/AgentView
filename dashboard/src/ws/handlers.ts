import type { WsServerToClient } from "@agentview/shared";
import { useAgentView } from "../store";

// ── Handler 1: init ───────────────────────────────────────────────────────────

function handleInit(msg: Extract<WsServerToClient, { type: "init" }>): void {
  useAgentView.getState().initFromServer(msg);
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export function handleMessage(msg: WsServerToClient): void {
  switch (msg.type) {
    case "init":              return handleInit(msg);
  }
}
