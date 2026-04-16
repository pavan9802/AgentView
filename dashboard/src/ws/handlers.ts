import type { WsServerToClient, WsInitMessage, WsSessionStartedMessage } from "@agentview/shared";
import { useAgentView } from "../store";

// ── Handler 1: init ───────────────────────────────────────────────────────────

function handleInit(msg: WsInitMessage): void {
  useAgentView.getState().initFromServer(msg);
}

// ── Handler 2: session_started ────────────────────────────────────────────────

function handleSessionStarted(msg: WsSessionStartedMessage): void {
  const { upsertSession, setActiveId, activeId } = useAgentView.getState();
  upsertSession(msg.session);
  if (activeId === null) setActiveId(msg.session.id);
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export function handleMessage(msg: WsServerToClient): void {
  switch (msg.type) {
    case "init":             return handleInit(msg);
    case "session_started":  return handleSessionStarted(msg);
  }
}
