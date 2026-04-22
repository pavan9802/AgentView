import type { ToolCall } from "@agentview/shared";
import {
  sessions,
  ccSessionIdToAvId,
  createCcSession,
  sessionToPublic,
  type CcSessionState,
} from "../state";
import { send } from "../ws/send";

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

    // Broadcast updated session so the dashboard shows the prompt immediately
    // (session_started was sent in handleHookSessionStart with prompt: "").
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
      // Pre-mark as approved: PostToolUse firing means CC (and the user in the
      // terminal) allowed the tool to run.
      session.approvedToolUseIds.add(tool_use_id);
    }

    return ok({ decision: "allow" });
  } catch {
    return ok({ decision: "allow" });
  }
}
