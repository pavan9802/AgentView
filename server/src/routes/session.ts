import type { StartSessionRequest, StartSessionResponse, AddTurnRequest, AddTurnResponse } from "@agentview/shared";
import { sessions, sessionToPublic } from "../state";
import { runAgentSession } from "../agent/runner";
import { send } from "../ws/send";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

export async function handlePostSession(req: Request): Promise<Response> {
  let body: StartSessionRequest;
  try {
    body = (await req.json()) as StartSessionRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body", code: "invalid_request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

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
    return new Response(JSON.stringify({ error: "Session not found", code: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: AddTurnRequest;
  try {
    body = (await req.json()) as AddTurnRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body", code: "invalid_request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.prompt?.trim()) {
    return new Response(JSON.stringify({ error: "prompt is required", code: "invalid_request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = body.prompt.trim();

  if (session.status === "running") {
    // Live injection — push into the queue attached to the running query via streamInput
    if (!session.promptQueue || !session.sdk_session_id) {
      return new Response(JSON.stringify({ error: "Session is not ready for injection", code: "invalid_state" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Session cannot be resumed", code: "not_resumable" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
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
