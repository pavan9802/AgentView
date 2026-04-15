export type SessionStatus = "created" | "running" | "complete" | "errored" | "killed";
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
