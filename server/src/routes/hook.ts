import {
  sessions,
  ccSessionIdToAvId,
  createCcSession,
  sessionToPublic,
  type CcSessionState,
} from "../state";
import { send } from "../ws/send";

function ok(body: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

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
