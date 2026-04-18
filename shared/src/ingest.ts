import type { Turn, ToolCall, ErrorReason, KillReason } from "./session";

// ── Agent → Server (over /agent-ws WS or POST /ingest) ───────────────────

export type AgentSessionStartedMessage = {
  type: "session_started";
  session_id: string;
  prompt: string;
  cwd: string;
  created_at: number;
  approval_required_tools: string[];
};

export type AgentTurnUpdateMessage = {
  type: "turn_update";
  session_id: string;
  turn: Turn;
  cumulative_cost_usd: number;
  cumulative_tokens: number;
};

export type AgentToolCallMessage = {
  type: "tool_call";
  session_id: string;
  tool_call: ToolCall;
};

export type AgentToolResultMessage = {
  type: "tool_result";
  session_id: string;
  tool_call_id: string;
  output: string;
};

export type AgentApprovalRequiredMessage = {
  type: "approval_required";
  session_id: string;
  tool_call_id: string;
  tool_name: string;
  tool_input: string;
};

export type AgentSessionCompleteMessage = {
  type: "session_complete";
  session_id: string;
  total_cost_usd: number;
  total_tokens: number;
  total_turns: number;
  result_text: string;
};

export type AgentSessionErroredMessage = {
  type: "session_errored";
  session_id: string;
  error_type: ErrorReason;
  error_message: string;
};

export type AgentSessionKilledMessage = {
  type: "session_killed";
  session_id: string;
  reason: KillReason;
};

export type AgentToServer =
  | AgentSessionStartedMessage
  | AgentTurnUpdateMessage
  | AgentToolCallMessage
  | AgentToolResultMessage
  | AgentApprovalRequiredMessage
  | AgentSessionCompleteMessage
  | AgentSessionErroredMessage
  | AgentSessionKilledMessage;

// ── Server → Agent (back over /agent-ws WS) ──────────────────────────────

export type ServerApprovalResponseMessage = {
  type: "approval_response";
  tool_call_id: string;
  approved: boolean;
};

export type ServerKillMessage = {
  type: "kill";
  session_id: string;
};

export type ServerToAgent = ServerApprovalResponseMessage | ServerKillMessage;
