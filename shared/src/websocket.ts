import type { Session, Turn, ToolCall, KeyStatus, ErrorReason, KillReason } from "./session";
import type { SyncStatus } from "./config";

// ── Shared structures ─────────────────────────────────────────────────────────

export type PendingApproval = {
  tool_call_id: string;
  session_id: string;
  tool_name: string;
  tool_input: string; // JSON-serialised object
};

// ── Server → Client ──────────────────────────────────────────────────────────

export type WsInitMessage = {
  type: "init";
  sessions: Session[];
  turns: Turn[];
  tool_calls: ToolCall[];
  pending_approvals: PendingApproval[];
  key_status: KeyStatus;
  sync_status: SyncStatus;
};

export type WsSessionStartedMessage = {
  type: "session_started";
  session: Session;
};

export type WsTurnUpdateMessage = {
  type: "turn_update";
  session_id: string;
  turn: Turn;
  cumulative_cost_usd: number;
  cumulative_tokens: number;
};

export type WsToolCallMessage = {
  type: "tool_call";
  session_id: string;
  tool_call: ToolCall;
};

export type WsToolResultMessage = {
  type: "tool_result";
  session_id: string;
  tool_call_id: string;
  output: string; // plain text or JSON-serialised tool output
};

export type WsApprovalRequiredMessage = { type: "approval_required" } & PendingApproval;

export type WsSessionCompleteMessage = {
  type: "session_complete";
  session_id: string;
  total_cost_usd: number;
  total_turns: number;
  result_text: string;
};

export type WsSessionErroredMessage = {
  type: "session_errored";
  session_id: string;
  error_type: ErrorReason;
  error_message: string;
};

export type WsSessionKilledMessage = {
  type: "session_killed";
  session_id: string;
  reason: KillReason;
};

export type WsKeyStatusMessage = {
  type: "key_status";
  status: KeyStatus;
};

export type WsSyncStatusMessage = {
  type: "sync_status";
  status: SyncStatus;
};

export type WsServerToClient =
  | WsInitMessage
  | WsSessionStartedMessage
  | WsTurnUpdateMessage
  | WsToolCallMessage
  | WsToolResultMessage
  | WsApprovalRequiredMessage
  | WsSessionCompleteMessage
  | WsSessionErroredMessage
  | WsSessionKilledMessage
  | WsKeyStatusMessage
  | WsSyncStatusMessage;

// ── Client → Server ──────────────────────────────────────────────────────────

export type WsApprovalResponseMessage = {
  type: "approval_response";
  session_id: string;
  tool_call_id: string;
  approved: boolean;
};

export type WsKillSessionMessage = {
  type: "kill_session";
  session_id: string;
};

export type WsSetApprovalConfigMessage = {
  type: "set_approval_config";
  session_id: string;
  approval_required_tools: string[];
};

export type WsClientToServer = WsApprovalResponseMessage | WsKillSessionMessage | WsSetApprovalConfigMessage;
