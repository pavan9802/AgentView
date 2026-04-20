import type { StartSessionRequest, StartSessionResponse, AddTurnRequest, AddTurnResponse } from "@agentview/shared";
import { sessions, sessionToPublic } from "../state";
import { runAgentSession } from "../agent/runner";
import { send } from "../ws/send";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

function jsonError(message: string, code: string, status: number): Response {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handlePostSession(req: Request): Promise<Response> {
  let body: StartSessionRequest;
  try {
    body = (await req.json()) as StartSessionRequest;
  } catch {
    return jsonError("Invalid JSON body", "invalid_request", 400);
  }

  if (!body.prompt?.trim()) {
    return jsonError("prompt is required", "invalid_request", 400);
  }

  const id = crypto.randomUUID();
  const cwd = process.cwd();

  sessions.set(id, {
    id,
    sdk_session_id: null, // populated when the SDK emits its system:init message
    abortController: new AbortController(),
    promptQueue: null, // set by runner once query() starts
    prompt: body.prompt.trim(),
    cwd,
    status: "running",
    created_at: Date.now(),
    started_at: Date.now(),
    completed_at: null,
    total_cost_usd: 0,
    total_tokens: 0,
    total_turns: 0,
    result_text: null,
    error_type: null,
    error_message: null,
    kill_reason: null,
    approvalRequiredTools: new Set(body.approval_required_tools ?? ["Bash", "Write"]),
    approvedToolUseIds: new Set(),
  });

  send({ type: "session_started", session: sessionToPublic(sessions.get(id)!) });

  // Fire and forget — agent runs in background
  void runAgentSession(id);

  const response: StartSessionResponse = { id, status: "running" };
  return new Response(JSON.stringify(response), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handlePostTurn(req: Request, sessionId: string): Promise<Response> {
  const session = sessions.get(sessionId);

  if (!session) {
    return jsonError("Session not found", "not_found", 404);
  }

  let body: AddTurnRequest;
  try {
    body = (await req.json()) as AddTurnRequest;
  } catch {
    return jsonError("Invalid JSON body", "invalid_request", 400);
  }

  if (!body.prompt?.trim()) {
    return jsonError("prompt is required", "invalid_request", 400);
  }

  const prompt = body.prompt.trim();

  if (session.status === "running") {
    // Live injection — push into the queue attached to the running query via streamInput
    if (!session.promptQueue || !session.sdk_session_id) {
      return jsonError("Session is not ready for injection", "invalid_state", 409);
    }
    const msg: SDKUserMessage = {
      type: "user",
      message: { role: "user", content: prompt },
      parent_tool_use_id: null,
      session_id: session.sdk_session_id,
      priority: "next",
    };
    session.promptQueue.push(msg);
  } else {
    // Resume — session is complete, errored, or killed
    if (!session.sdk_session_id) {
      return jsonError("Session cannot be resumed", "not_resumable", 409);
    }
    void runAgentSession(sessionId, prompt);
    send({ type: "session_resumed", session: sessionToPublic(session) });
  }

  const response: AddTurnResponse = { ok: true };
  return new Response(JSON.stringify(response), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
}
