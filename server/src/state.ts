import type { ErrorReason, KillReason, Session, SessionStatus } from "@agentview/shared";
import type { PromptQueue } from "./agent/promptQueue";

export type SessionState = {
  id: string;                    // our internal UUID (used as the primary key everywhere)
  sdk_session_id: string | null; // SDK-assigned session ID — needed to resume via query({ options: { resume } })
  abortController: AbortController;
  promptQueue: PromptQueue | null; // non-null only while query() is iterating; used for live injection via streamInput
  prompt: string;
  cwd: string;
  status: SessionStatus;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  total_cost_usd: number;
  total_tokens: number;
  total_turns: number;
  result_text: string | null;
  error_type: ErrorReason | null;
  error_message: string | null;
  kill_reason: KillReason | null;
  approvalRequiredTools: Set<string>;
  approvedToolUseIds: Set<string>;
};

/** All active and completed sessions (in-memory, no persistence yet). */
export const sessions = new Map<string, SessionState>();

/** The single connected dashboard WebSocket (null when no dashboard is open). */
export let client: BunServerWebSocket | null = null;

export function setClient(ws: BunServerWebSocket | null): void {
  client = ws;
}

/** External agent WebSocket connections keyed by session_id. */
export const agentConnections = new Map<string, BunServerWebSocket>();

/** Pending approval callbacks keyed by tool_use_id. */
export const pendingApprovals = new Map<string, (approved: boolean) => void>();

/** Pending approval details keyed by tool_use_id — used to replay on reconnect. */
export const pendingApprovalDetails = new Map<string, { session_id: string; tool_name: string; tool_input: string }>();

/** Strip internal fields before sending a session over the wire. */
export function sessionToPublic(s: SessionState): Session {
  return {
    id: s.id,
    prompt: s.prompt,
    cwd: s.cwd,
    status: s.status,
    created_at: s.created_at,
    started_at: s.started_at,
    completed_at: s.completed_at,
    total_cost_usd: s.total_cost_usd,
    total_tokens: s.total_tokens,
    total_turns: s.total_turns,
    result_text: s.result_text,
    error_type: s.error_type,
    error_message: s.error_message,
    kill_reason: s.kill_reason,
    approval_required_tools: [...s.approvalRequiredTools],
  };
}
