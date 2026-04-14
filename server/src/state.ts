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

/** The single connected dashboard WebSocket (null when no dashboard is open). */
export let client: BunServerWebSocket | null = null;

export function setClient(ws: BunServerWebSocket | null): void {
  client = ws;
}

/** Pending approval callbacks keyed by tool_use_id. */
export const pendingApprovals = new Map<string, (approved: boolean) => void>();
