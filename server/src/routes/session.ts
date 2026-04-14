import type { StartSessionRequest, StartSessionResponse, AddTurnRequest, AddTurnResponse } from "@agentview/shared";
import { sessions, sessionToPublic } from "../state";
import { runAgentSession } from "../agent/runner";
import { send } from "../ws/send";

export async function handlePostSession(req: Request): Promise<Response> {
  const body = (await req.json()) as StartSessionRequest;

  if (!body.prompt?.trim()) {
    return new Response(JSON.stringify({ error: "prompt is required", code: "invalid_request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = crypto.randomUUID();
  const cwd = process.cwd();

  sessions.set(id, {
    id,
    sdk_session_id: null, // populated when the SDK emits its system:init message
    abortController: new AbortController(),
    prompt: body.prompt.trim(),
    cwd,
    status: "created",
    created_at: Date.now(),
    started_at: null,
    completed_at: null,
    total_cost_usd: 0,
    total_tokens: 0,
    total_turns: 0,
    result_text: null,
    error_type: null,
    error_message: null,
    kill_reason: null,
    approvalRequiredTools: new Set(body.approval_required_tools ?? ["Bash", "Write"]),
  });

  send({ type: "session_started", session: sessionToPublic(sessions.get(id)!) });

  // Fire and forget — agent runs in background
  void runAgentSession(id);

  const response: StartSessionResponse = { id, status: "created" };
  return new Response(JSON.stringify(response), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handlePostTurn(req: Request, sessionId: string): Promise<Response> {
  const session = sessions.get(sessionId);

  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found", code: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (session.status !== "complete") {
    return new Response(JSON.stringify({ error: "Session is not complete", code: "invalid_state" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!session.sdk_session_id) {
    return new Response(JSON.stringify({ error: "Session cannot be resumed", code: "not_resumable" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = (await req.json()) as AddTurnRequest;

  if (!body.prompt?.trim()) {
    return new Response(JSON.stringify({ error: "prompt is required", code: "invalid_request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  void runAgentSession(sessionId, body.prompt.trim());

  const response: AddTurnResponse = { ok: true };
  return new Response(JSON.stringify(response), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
}
