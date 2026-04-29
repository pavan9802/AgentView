import type { ToolCall, Turn, ErrorReason } from "@agentview/shared";
import {
  sessions,
  ccSessionIdToAvId,
  createCcSession,
  sessionToPublic,
  pendingApprovalDetails,
  type CcSessionState,
} from "../state";
import { send } from "../ws/send";
import { computeTurnCost } from "../lib/pricing";
import { checkSessionLimits } from "../agent/handlers/turnUsage";

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Look up a CC session by its Claude Code session_id. Returns null if unknown. */
function getCcSession(ccSessionId: string): { avId: string; session: CcSessionState } | null {
  const avId = ccSessionIdToAvId.get(ccSessionId);
  if (!avId) return null;
  const session = sessions.get(avId);
  if (!session || session.source !== "claude_code") return null;
  return { avId, session: session as CcSessionState };
}

/**
 * Extract plain text from a CC content-block array [{type:"text",text:"..."}].
 * Handles string passthrough for plain-string responses (B7 fix, server layer).
 */
function extractTextFromContent(val: unknown): string {
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    return (val as Array<{ type?: string; text?: string }>)
      .filter((b) => b?.type === "text" && typeof b?.text === "string")
      .map((b) => b.text!)
      .join("\n");
  }
  return JSON.stringify(val ?? "");
}

function ok(body: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Session-Start ─────────────────────────────────────────────────────────────

/**
 * Shared post-tool processing for both success and failure paths.
 * Computes duration, resolves approval status, builds ToolCall, and broadcasts.
 */
function buildAndBroadcastToolCall(
  session: CcSessionState,
  avId: string,
  params: { tool_use_id: string; tool_name: string; tool_input: unknown; error: string | null },
): ToolCall {
  const { tool_use_id, tool_name, tool_input, error } = params;

  const duration_ms = Date.now() - (session.toolTimestamps.get(tool_use_id) ?? Date.now());
  session.toolTimestamps.delete(tool_use_id);

  const wasApprovalRequired = session.approvalRequiredTools.has(tool_name);
  const approved = wasApprovalRequired ? session.approvedToolUseIds.has(tool_use_id) : null;
  if (wasApprovalRequired) session.approvedToolUseIds.delete(tool_use_id);
  pendingApprovalDetails.delete(tool_use_id);

  const toolCall: ToolCall = {
    id: tool_use_id,
    session_id: avId,
    turn_id: session.currentTurnId ?? "",
    tool_name,
    tool_input: JSON.stringify(tool_input),
    duration_ms,
    approved,
    error,
    created_at: Date.now(),
  };
  send({ type: "tool_call", session_id: avId, tool_call: toolCall });
  return toolCall;
}

type SessionStartPayload = {
  session_id: string;
  model?: string;
  cwd?: string;
  permission_mode?: string;
  source?: string; // "resume" | "clear" | "compact" when set by Claude Code
};

export async function handleHookSessionStart(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as SessionStartPayload;
    const ccSessionId = body.session_id;
    if (!ccSessionId) return ok();

    // /compact fires SessionStart with the same CC session_id that already exists
    // in the map → ignore (B8 fix: use map lookup, not a source field).
    if (ccSessionIdToAvId.has(ccSessionId)) return ok();

    const resumed = body.source === "resume";
    const avId = createCcSession(ccSessionId, { ...(body.model ? { model: body.model } : {}), resumed });
    const session = sessions.get(avId) as CcSessionState;

    if (body.cwd) session.cwd = body.cwd;

    // Seed approval gates from Claude Code's permission_mode.
    const pm = body.permission_mode ?? "default";
    if (pm === "auto" || pm === "bypassPermissions") {
      session.approvalRequiredTools = new Set();
    } else if (pm === "acceptEdits") {
      session.approvalRequiredTools = new Set(["Bash"]);
    } else {
      // "default" | "plan" | unknown
      session.approvalRequiredTools = new Set(["Bash", "Write", "Edit", "MultiEdit", "NotebookEdit"]);
    }

    send({ type: "session_started", session: sessionToPublic(session) });
  } catch {
    // always 200 — hook script must never be blocked
  }
  return ok();
}

// ── User-Prompt-Submit ────────────────────────────────────────────────────────

type UserPromptSubmitPayload = {
  session_id: string;
  prompt?: string;
};

export async function handleHookUserPromptSubmit(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as UserPromptSubmitPayload;
    const result = getCcSession(body.session_id);
    if (!result) return ok();
    const { session } = result;

    // Set prompt once (first message only; subsequent turns don't overwrite).
    if (session.prompt === "") session.prompt = body.prompt ?? "";

    // Initialise turn tracking for the upcoming turn.
    session.total_turns += 1;
    session.currentTurnId = crypto.randomUUID();
    session.turnStartedAt = Date.now();

    // Re-broadcast as session_started (no separate session_updated type).
    // The dashboard's handleSessionStarted calls upsertSession (keyed by id),
    // so this is an idempotent upsert that pushes the prompt immediately.
    send({ type: "session_started", session: sessionToPublic(session) });
  } catch {
    // always 200
  }
  return ok();
}

// ── Pre-Tool-Use ──────────────────────────────────────────────────────────────

type PreToolUsePayload = {
  session_id: string;
  tool_use_id: string;
  tool_name: string;
  tool_input: unknown;
};

export async function handleHookPreToolUse(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as PreToolUsePayload;
    const result = getCcSession(body.session_id);
    if (!result) return ok({ decision: "allow" });
    const { avId, session } = result;
    const { tool_use_id, tool_name, tool_input } = body;

    // Kill flag — only hard gate: deny at tool boundary so the session stops.
    if (session.killRequested) return ok({ decision: "deny" });

    // Record tool start time for duration_ms in PostToolUse.
    session.toolTimestamps.set(tool_use_id, Date.now());

    // Observer mode: if tool requires approval, show the card on the dashboard
    // and mark it as approved so PostToolUse records approved: true when the
    // tool completes. CC handles its own terminal approval prompt — we don't block.
    if (session.approvalRequiredTools.has(tool_name)) {
      send({
        type: "approval_required",
        session_id: avId,
        tool_call_id: tool_use_id,
        tool_name,
        tool_input: JSON.stringify(tool_input),
      });
      // Track for WS reconnect replay — cleaned up in PostToolUse / PostToolUseFail.
      pendingApprovalDetails.set(tool_use_id, { session_id: avId, tool_name, tool_input: JSON.stringify(tool_input) });
      // Pre-mark as approved: PostToolUse firing means CC (and the user in the
      // terminal) allowed the tool to run.
      session.approvedToolUseIds.add(tool_use_id);
    }

    return ok({ decision: "allow" });
  } catch {
    return ok({ decision: "allow" });
  }
}

// ── Post-Tool-Use ─────────────────────────────────────────────────────────────

type PostToolUsePayload = {
  session_id: string;
  tool_use_id: string;
  tool_name: string;
  tool_input: unknown;
  tool_response: unknown;
};

export async function handleHookPostToolUse(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as PostToolUsePayload;
    const result = getCcSession(body.session_id);
    if (!result) return ok();
    const { avId, session } = result;
    const { tool_use_id, tool_name, tool_input, tool_response } = body;

    buildAndBroadcastToolCall(session, avId, { tool_use_id, tool_name, tool_input, error: null });

    // Extract plain text from CC content-block array (B7 fix).
    const output = extractTextFromContent(tool_response);
    send({ type: "tool_result", session_id: avId, tool_call_id: tool_use_id, output });
  } catch {
    // always 200
  }
  return ok();
}

// ── Post-Tool-Use-Fail ────────────────────────────────────────────────────────

type PostToolUseFailPayload = {
  session_id: string;
  tool_use_id: string;
  tool_name: string;
  tool_input: unknown;
  error: string;
  is_interrupt?: boolean;
};

export async function handleHookPostToolUseFail(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as PostToolUseFailPayload;
    const result = getCcSession(body.session_id);
    if (!result) return ok();
    const { avId, session } = result;
    const { tool_use_id, tool_name, tool_input, error, is_interrupt } = body;

    const errorMessage = is_interrupt ? "Interrupted by user" : (error || "Tool execution failed");
    buildAndBroadcastToolCall(session, avId, { tool_use_id, tool_name, tool_input, error: errorMessage });
  } catch {
    // always 200
  }
  return ok();
}

// ── Stop ──────────────────────────────────────────────────────────────────────

type StopPayload = {
  session_id: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
};

export async function handleHookStop(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as StopPayload;
    const result = getCcSession(body.session_id);
    if (!result) return ok();
    const { avId, session } = result;

    // B11 fix: if the session was killed at a tool boundary, CC may still fire
    // Stop as it wraps up. Same for errored (StopFailure + Stop race). Skip
    // turn creation and cost tracking in either terminal state — just clean up.
    if (session.status === "killed" || session.status === "errored") {
      session.currentTurnId = null;
      session.turnStartedAt = null;
      return ok();
    }

    const latency_ms = Date.now() - (session.turnStartedAt ?? Date.now());

    // Build a Turn only if usage data is present (enriched by hook script, task 5.7).
    // If usage is absent, skip turn creation but still run budget/max_turns checks.
    if (body.usage) {
      const inputTok = body.usage.input_tokens ?? 0;
      const outputTok = body.usage.output_tokens ?? 0;
      const cacheWriteTok = body.usage.cache_creation_input_tokens ?? 0;
      const cacheReadTok = body.usage.cache_read_input_tokens ?? 0;

      const cost_usd = computeTurnCost(
        { input_tokens: inputTok, output_tokens: outputTok, cache_creation_input_tokens: cacheWriteTok, cache_read_input_tokens: cacheReadTok },
        session.model,
      );
      const context_fill_pct = Math.min((inputTok / 200_000) * 100, 100);

      session.total_tokens += inputTok + outputTok;
      session.total_cost_usd += cost_usd;

      const turn: Turn = {
        id: session.currentTurnId ?? crypto.randomUUID(),
        session_id: avId,
        turn_number: session.total_turns,
        input_tokens: inputTok,
        output_tokens: outputTok,
        cost_usd,
        context_fill_pct,
        latency_ms,
        created_at: Date.now(),
      };

      send({
        type: "turn_update",
        session_id: avId,
        turn,
        cumulative_cost_usd: session.total_cost_usd,
        cumulative_tokens: session.total_tokens,
      });
    }

    // Clear turn tracking — this turn is done regardless of whether usage was present.
    session.currentTurnId = null;
    session.turnStartedAt = null;

    if (checkSessionLimits(session, avId, session.total_turns)) return ok();
  } catch {
    // always 200
  }
  return ok();
}

// ── Stop-Failure ──────────────────────────────────────────────────────────────

type StopFailurePayload = {
  session_id: string;
  error?: unknown;
};

export async function handleHookStopFailure(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as StopFailurePayload;
    const result = getCcSession(body.session_id);
    if (!result) return ok();
    const { avId, session } = result;

    // Skip if already in a terminal state (e.g. kill raced with an API error).
    if (session.status === "killed" || session.status === "errored") return ok();

    const raw = JSON.stringify(body.error ?? "").toLowerCase();
    const error_type: ErrorReason = raw.includes("rate_limit")
      ? "rate_limited"
      : raw.includes("authentication_failed") || raw.includes("invalid x-api-key")
        ? "invalid_api_key"
        : "api_unavailable";

    const error_message =
      typeof body.error === "string"
        ? body.error
        : (body.error as { message?: string } | null)?.message ?? "Unknown error";

    session.status = "errored";
    session.completed_at = Date.now();
    session.error_type = error_type;
    session.error_message = error_message;

    send({ type: "session_errored", session_id: avId, error_type, error_message, completed_at: session.completed_at! });
  } catch {
    // always 200
  }
  return ok();
}

// ── Session-End ───────────────────────────────────────────────────────────────

type SessionEndPayload = {
  session_id: string;
};

export async function handleHookSessionEnd(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as SessionEndPayload;
    const result = getCcSession(body.session_id);
    if (!result) return ok();
    const { avId, session } = result;

    // Already in a terminal state — killed or errored; do not overwrite.
    if (session.status === "killed" || session.status === "errored") return ok();

    session.status = "complete";
    session.completed_at = Date.now();
    // B5 fix: result_text is "" not null — keeps the type consistent with the wire message.
    session.result_text = "";

    send({
      type: "session_complete",
      session_id: avId,
      total_cost_usd: session.total_cost_usd,
      total_tokens: session.total_tokens,
      total_turns: session.total_turns,
      result_text: "",
      completed_at: session.completed_at!,
    });
  } catch {
    // always 200
  }
  return ok();
}
