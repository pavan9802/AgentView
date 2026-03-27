import type { Session, Turn, ToolCall, KeyStatus, ErrorReason, KillReason } from "./session";
import type { SyncStatus } from "./config";

// ── Server → Client ──────────────────────────────────────────────────────────

export type WsInitMessage = {
  type: "init";
  sessions: Session[];
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

export type WsApprovalRequiredMessage = {
  type: "approval_required";
  session_id: string;
  tool_call_id: string;
  tool_name: string;
  tool_input: string; // JSON-serialised object
};

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

export type WsClientToServer = WsApprovalResponseMessage | WsKillSessionMessage;
