import type { SessionStatus } from "@agentview/shared";

export type SessionState = {
  id: string;                    // our internal UUID (used as the primary key everywhere)
  sdk_session_id: string | null; // SDK-assigned session ID — needed to resume via query({ options: { resume } })
  prompt: string;
  cwd: string;
  status: SessionStatus;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  total_cost_usd: number;
  total_tokens: number;
  total_turns: number;
};

/** All active and completed sessions (in-memory, no persistence yet). */
export const sessions = new Map<string, SessionState>();

/** All connected WebSocket clients. */
export const clients = new Set<WebSocket>();

/** Pending approval callbacks keyed by tool_use_id. */
export const pendingApprovals = new Map<string, (approved: boolean) => void>();
