import type { WsServerToClient, WsInitMessage, WsSessionStartedMessage, WsTurnUpdateMessage, WsToolCallMessage, WsToolResultMessage, WsApprovalRequiredMessage, WsSessionCompleteMessage, WsSessionErroredMessage, WsSessionKilledMessage, WsKeyStatusMessage, WsSyncStatusMessage, WsSessionResumedMessage, WsInjectionFailedMessage, WsUserPromptMessage, WsAssistantMessageMessage } from "@agentview/shared";
import { useAgentView, cancelKillTimer } from "../store";

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
    upsertSession({ ...existingSession, total_cost_usd: msg.cumulative_cost_usd, total_tokens: msg.cumulative_tokens, total_turns: msg.turn.turn_number });
  }
}

// ── Handler 4: tool_call ──────────────────────────────────────────────────────

function handleToolCall(msg: WsToolCallMessage): void {
  const { upsertToolCall, removePendingApproval } = useAgentView.getState();
  upsertToolCall(msg.tool_call);
  removePendingApproval(msg.session_id, msg.tool_call.id);
}

// ── Handler 5: session_complete ───────────────────────────────────────────────

function handleSessionComplete(msg: WsSessionCompleteMessage): void {
  const { sessions, upsertSession, clearPendingApprovalsForSession } = useAgentView.getState();
  const existing = sessions[msg.session_id];
  if (existing) {
    upsertSession({
      ...existing,
      status: "complete",
      completed_at: Date.now(),
      total_cost_usd: msg.total_cost_usd,
      total_tokens: msg.total_tokens,
      total_turns: msg.total_turns,
      result_text: msg.result_text,
    });
  }
  clearPendingApprovalsForSession(msg.session_id);
}

// ── Handler 6: key_status ─────────────────────────────────────────────────────

function handleKeyStatus(msg: WsKeyStatusMessage): void {
  useAgentView.getState().setKeyStatus(msg.status);
}

// ── Handler 7: sync_status ────────────────────────────────────────────────────

function handleSyncStatus(msg: WsSyncStatusMessage): void {
  useAgentView.getState().setSyncStatus(msg.status);
}

// ── Handler 8: session_killed ─────────────────────────────────────────────────

function handleSessionKilled(msg: WsSessionKilledMessage): void {
  cancelKillTimer(msg.session_id);
  const { sessions, upsertSession, clearPendingApprovalsForSession } = useAgentView.getState();
  const existing = sessions[msg.session_id];
  if (existing) {
    upsertSession({ ...existing, status: "killed", kill_reason: msg.reason });
  }
  clearPendingApprovalsForSession(msg.session_id);
}

// ── Handler 9: session_errored ────────────────────────────────────────────────

function handleSessionErrored(msg: WsSessionErroredMessage): void {
  const { sessions, upsertSession, clearPendingApprovalsForSession } = useAgentView.getState();
  const existing = sessions[msg.session_id];
  if (existing) {
    upsertSession({ ...existing, status: "errored", error_type: msg.error_type, error_message: msg.error_message });
  }
  clearPendingApprovalsForSession(msg.session_id);
}

// ── Handler 10: approval_required ────────────────────────────────────────────

function handleApprovalRequired(msg: WsApprovalRequiredMessage): void {
  // Auto-approve all tools from Claude Code — sends the response immediately
  // so the hook's long-poll HTTP request unblocks without user interaction.
  useAgentView.getState().sendApprovalResponse(msg.session_id, msg.tool_call_id, true);
}

// ── Handler 11: tool_result ───────────────────────────────────────────────────

function handleToolResult(msg: WsToolResultMessage): void {
  console.log("[tool_result]", msg.session_id, msg.output);
}

// ── Handler 12: session_resumed ──────────────────────────────────────────────

function handleSessionResumed(msg: WsSessionResumedMessage): void {
  useAgentView.getState().upsertSession(msg.session);
}

// ── Handler 13: user_prompt ───────────────────────────────────────────────────

function handleUserPrompt(msg: WsUserPromptMessage): void {
  const { addPrompt, sessions, upsertSession } = useAgentView.getState();
  addPrompt({ id: msg.id, session_id: msg.session_id, type: "prompt", prompt: msg.prompt, ts: msg.created_at });
  // Update session name if it's still the placeholder.
  const session = sessions[msg.session_id];
  if (session && session.prompt.startsWith("Claude Code session ")) {
    upsertSession({ ...session, prompt: msg.prompt });
  }
}

// ── Handler 14: assistant_message ────────────────────────────────────────────

function handleAssistantMessage(msg: WsAssistantMessageMessage): void {
  useAgentView.getState().addAssistantMessage({
    id: msg.id,
    session_id: msg.session_id,
    type: "assistant",
    text: msg.text,
    ts: msg.created_at,
  });
}

// ── Handler 15: injection_failed ─────────────────────────────────────────────

let injectionDismissTimer: ReturnType<typeof setTimeout> | null = null;

function handleInjectionFailed(msg: WsInjectionFailedMessage): void {
  if (injectionDismissTimer !== null) clearTimeout(injectionDismissTimer);
  useAgentView.getState().setInjectionError(msg.error);
  injectionDismissTimer = setTimeout(() => {
    useAgentView.getState().setInjectionError(null);
    injectionDismissTimer = null;
  }, 5000);
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export function handleMessage(msg: WsServerToClient): void {
  switch (msg.type) {
    case "init":              return handleInit(msg);
    case "session_started":   return handleSessionStarted(msg);
    case "turn_update":       return handleTurnUpdate(msg);
    case "tool_call":         return handleToolCall(msg);
    case "tool_result":       return handleToolResult(msg);
    case "approval_required": return handleApprovalRequired(msg);
    case "session_complete":  return handleSessionComplete(msg);
    case "session_errored":   return handleSessionErrored(msg);
    case "session_killed":    return handleSessionKilled(msg);
    case "key_status":        return handleKeyStatus(msg);
    case "sync_status":       return handleSyncStatus(msg);
    case "session_resumed":     return handleSessionResumed(msg);
    case "injection_failed":    return handleInjectionFailed(msg);
    case "user_prompt":         return handleUserPrompt(msg);
    case "assistant_message":   return handleAssistantMessage(msg);
  }
}
