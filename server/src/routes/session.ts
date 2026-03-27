import type { StartSessionRequest, StartSessionResponse } from "@agentview/shared";
import { sessions } from "../state";
import { runAgentSession } from "../agent/runner";

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
    prompt: body.prompt.trim(),
    cwd,
    status: "created",
    created_at: Date.now(),
    started_at: null,
    completed_at: null,
    total_cost_usd: 0,
    total_tokens: 0,
    total_turns: 0,
  });

  // Fire and forget — agent runs in background
  void runAgentSession(id);

  const response: StartSessionResponse = { id, status: "created" };
  return new Response(JSON.stringify(response), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
}
