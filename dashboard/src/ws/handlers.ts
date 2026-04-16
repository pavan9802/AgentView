import type { WsServerToClient, WsInitMessage, WsSessionStartedMessage, WsTurnUpdateMessage, WsToolCallMessage, WsToolResultMessage, WsApprovalRequiredMessage } from "@agentview/shared";
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
  const existingSession = sessions[msg.session_id];
  if (existingSession) {
    upsertSession({ ...existingSession, total_cost_usd: msg.cumulative_cost_usd, total_tokens: msg.cumulative_tokens });
  }
}

// ── Handler 4: tool_call ──────────────────────────────────────────────────────

function handleToolCall(msg: WsToolCallMessage): void {
  const { upsertToolCall, removePendingApproval } = useAgentView.getState();
  upsertToolCall(msg.tool_call);
  removePendingApproval(msg.session_id, msg.tool_call.id);
}

// ── Handler 6: approval_required ─────────────────────────────────────────────

function handleApprovalRequired(msg: WsApprovalRequiredMessage): void {
  useAgentView.getState().addPendingApproval({
    session_id: msg.session_id,
    tool_call_id: msg.tool_call_id,
    tool_name: msg.tool_name,
    tool_input: msg.tool_input,
  });
}

// ── Handler 5: tool_result ────────────────────────────────────────────────────

function handleToolResult(msg: WsToolResultMessage): void {
  console.log("[tool_result]", msg.session_id, msg.output);
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export function handleMessage(msg: WsServerToClient): void {
  switch (msg.type) {
    case "init":             return handleInit(msg);
    case "session_started":  return handleSessionStarted(msg);
    case "turn_update":      return handleTurnUpdate(msg);
    case "tool_call":        return handleToolCall(msg);
    case "tool_result":        return handleToolResult(msg);
    case "approval_required":  return handleApprovalRequired(msg);
  }
}
