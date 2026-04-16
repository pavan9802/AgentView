import type { WsServerToClient, WsInitMessage, WsSessionStartedMessage, WsTurnUpdateMessage } from "@agentview/shared";
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

// ── Handler 3: turn_update ────────────────────────────────────────────────────

function handleTurnUpdate(msg: WsTurnUpdateMessage): void {
  const { upsertTurn, upsertSession, sessions } = useAgentView.getState();
  upsertTurn(msg.turn);
  const existing = sessions[msg.session_id];
  if (existing) {
    upsertSession({ ...existing, total_cost_usd: msg.cumulative_cost_usd, total_tokens: msg.cumulative_tokens });
  }
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export function handleMessage(msg: WsServerToClient): void {
  switch (msg.type) {
    case "init":             return handleInit(msg);
    case "session_started":  return handleSessionStarted(msg);
    case "turn_update":      return handleTurnUpdate(msg);
  }
}
