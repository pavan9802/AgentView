// ── ID Glossary ───────────────────────────────────────────────────────────────
//
// session_id (Session.id)
//   Server-assigned UUID created when a session is POSTed to /sessions.
//   Carried on every WebSocket message and REST response so the client can
//   route events to the right session.
//
// sdk_session_id (SessionState.sdk_session_id — server-only)
//   The SDK's own session identifier, received from the first system:init
//   message emitted by the SDK generator.  Stored server-side and passed as
//   `resume` when the user continues a session.  Never sent to the client.
//
// Turn.id (turn_id)
//   Server UUID generated at the start of each SDK loop iteration
//   (loopState.currentTurnId) and rotated after every usage event.  Groups
//   all tool calls that occurred within one model turn.
//
// ToolCall.id  ==  SDK tool_use_id
//   The SDK supplies a stable tool_use_id for every tool invocation via the
//   PreToolUse / PostToolUse / PostToolUseFailure hooks and canUseTool.
//   That same id is used as ToolCall.id so that three separate WebSocket
//   messages can be correlated on the client:
//     1. approval_required  – server asks client to approve/deny this tool call
//     2. approval_response  – client replies with approved: true/false
//     3. tool_call          – server records the final outcome (success or error)
//   The client uses ToolCall.id to remove the pending approval entry once the
//   tool_call message arrives, so these ids MUST match.
//
// ─────────────────────────────────────────────────────────────────────────────

export type SessionStatus = "running" | "complete" | "errored" | "killed";
export type KeyStatus = "valid" | "invalid" | "rate_limited" | "unknown";
export type KillReason = "user_requested" | "budget_exceeded" | "max_turns_exceeded" | "server_shutdown";
export type ErrorReason = "api_unavailable" | "invalid_api_key" | "model_error" | "rate_limited";

export type Session = {
  id: string;
  prompt: string;
  cwd: string;
  status: SessionStatus;
  created_at: number; // unix ms
  started_at: number | null;
  completed_at: number | null;
  total_cost_usd: number;
  total_tokens: number;
  total_turns: number;
  error_type: ErrorReason | null;
  error_message: string | null;
  kill_reason: KillReason | null;
  result_text: string | null;
  approval_required_tools: string[];
};

export type Turn = {
  id: string;
  session_id: string;
  turn_number: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  context_fill_pct: number; // 0–100
  latency_ms: number;
  created_at: number;
};

export type ToolCall = {
  id: string;
  session_id: string;
  turn_id: string;
  tool_name: string;
  tool_input: string; // JSON-serialised object
  duration_ms: number;
  approved: boolean | null; // null if no approval required
  error: string | null;
  created_at: number;
};
