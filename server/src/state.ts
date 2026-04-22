import type { ErrorReason, KillReason, Session, SessionStatus } from "@agentview/shared";
import type { PromptQueue } from "./agent/promptQueue";

// ── Session state types ────────────────────────────────────────────────────────
//
// SessionState is a discriminated union on `source`. Code that only touches
// shared fields can accept the plain `SessionState` union. Code that is
// source-specific should accept the narrower `AgentViewSessionState` or
// `CcSessionState` types — the compiler will then enforce that source-specific
// fields are not accidentally accessed on the wrong session type.
//
// BaseSessionState is intentionally NOT exported. Consumers should type
// parameters as `SessionState`, `AgentViewSessionState`, or `CcSessionState`.
// ─────────────────────────────────────────────────────────────────────────────

type BaseSessionState = {
  id: string;
  status: SessionStatus;
  source: "agentview" | "claude_code"; // typed broadly here; narrows via the union below
  prompt: string;            // "" until UserPromptSubmit hook fires for CC sessions
  cwd: string;               // "" until process-start hook fires for CC sessions
  model?: string;
  resumed?: boolean;
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
  // CC sessions carry an AbortController that is never meaningfully aborted
  // (their kill mechanism is killRequested: true). Keeping it on the base type
  // avoids narrowing guards in handler.ts, index.ts, and turnUsage.ts, which
  // all call .abort() on a plain SessionState.
  abortController: AbortController;
};

/** Session driven by the Claude Agent SDK query loop. */
export type AgentViewSessionState = BaseSessionState & {
  source: "agentview";
  sdk_session_id: string | null; // set by SessionStart hook; needed to resume
  promptQueue: PromptQueue | null; // non-null while query() is iterating
};

/** Session driven by HTTP hook events from the Claude Code hook script. */
export type CcSessionState = BaseSessionState & {
  source: "claude_code";
  turnStartedAt: number | null;         // start of current turn (agentview uses LoopState)
  currentTurnId: string | null;         // current turn UUID (agentview uses LoopState)
  toolTimestamps: Map<string, number>;  // keyed by tool_use_id (agentview uses LoopState)
  killRequested: boolean;               // CC kill flag; agentview uses abortController
};

export type SessionState = AgentViewSessionState | CcSessionState;

// ─────────────────────────────────────────────────────────────────────────────

/** All active and completed sessions (in-memory, no persistence yet). */
export const sessions = new Map<string, SessionState>();

/** Maps Claude Code's own session_id to our internal AgentView UUID. */
export const ccSessionIdToAvId = new Map<string, string>();

/** The single connected dashboard WebSocket (null when no dashboard is open). */
export let client: BunServerWebSocket | null = null;

export function setClient(ws: BunServerWebSocket | null): void {
  client = ws;
}

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
    source: s.source,
    ...(s.model !== undefined ? { model: s.model } : {}),
    ...(s.resumed !== undefined ? { resumed: s.resumed } : {}),
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

/**
 * Creates an on-the-fly CC session when a hook event arrives for an unknown CC session_id.
 * Returns the new AgentView UUID.
 */
export function createCcSession(ccSessionId: string, opts: { model?: string; resumed?: boolean } = {}): string {
  const id = crypto.randomUUID();
  const now = Date.now();
  sessions.set(id, {
    id,
    source: "claude_code",
    abortController: new AbortController(),
    prompt: "",
    cwd: "",
    status: "running",
    ...(opts.model !== undefined ? { model: opts.model } : {}),
    ...(opts.resumed !== undefined ? { resumed: opts.resumed } : {}),
    created_at: now,
    started_at: now,
    completed_at: null,
    total_cost_usd: 0,
    total_tokens: 0,
    total_turns: 0,
    result_text: null,
    error_type: null,
    error_message: null,
    kill_reason: null,
    approvalRequiredTools: new Set(), // overwritten by handleHookSessionStart based on permission_mode
    approvedToolUseIds: new Set(),
    turnStartedAt: null,
    currentTurnId: null,
    toolTimestamps: new Map(),
    killRequested: false,
  } satisfies CcSessionState);
  ccSessionIdToAvId.set(ccSessionId, id);
  return id;
}
