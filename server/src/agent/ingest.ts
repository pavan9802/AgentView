import type { AgentToServer } from "@agentview/shared";
import { sessions, agentConnections, pendingApprovals, pendingApprovalDetails } from "../state";
import { send } from "../ws/send";

/**
 * Process a single AgentToServer event coming from an external agent (either via
 * /agent-ws WebSocket or POST /ingest HTTP).  Returns a promise for approval events
 * so the caller can await the dashboard response before replying.
 *
 * agentWs — the persistent WS connection for this agent, if it has one.
 *   When set, approval responses are pushed back over that socket.
 *   When absent (HTTP ingest), the caller awaits the returned promise directly.
 */
export function processAgentEvent(
  msg: AgentToServer,
  agentWs?: BunServerWebSocket,
): Promise<boolean> | null {
  switch (msg.type) {
    case "session_started": {
      if (agentWs) agentConnections.set(msg.session_id, agentWs);

      if (!sessions.has(msg.session_id)) {
        sessions.set(msg.session_id, {
          id: msg.session_id,
          sdk_session_id: null,
          abortController: new AbortController(),
          prompt: msg.prompt,
          cwd: msg.cwd,
          status: "running",
          created_at: msg.created_at,
          started_at: msg.created_at,
          completed_at: null,
          total_cost_usd: 0,
          total_tokens: 0,
          total_turns: 0,
          result_text: null,
          error_type: null,
          error_message: null,
          kill_reason: null,
          approvalRequiredTools: new Set(msg.approval_required_tools),
          approvedToolUseIds: new Set(),
        });
      }

      send({
        type: "session_started",
        session: {
          id: msg.session_id,
          prompt: msg.prompt,
          cwd: msg.cwd,
          status: "running",
          created_at: msg.created_at,
          started_at: msg.created_at,
          completed_at: null,
          total_cost_usd: 0,
          total_tokens: 0,
          total_turns: 0,
          error_type: null,
          error_message: null,
          kill_reason: null,
          result_text: null,
          approval_required_tools: msg.approval_required_tools,
        },
      });
      return null;
    }

    case "turn_update": {
      const s = sessions.get(msg.session_id);
      if (s) {
        s.total_cost_usd = msg.cumulative_cost_usd;
        s.total_tokens = msg.cumulative_tokens;
        s.total_turns = msg.turn.turn_number;
      }
      send({
        type: "turn_update",
        session_id: msg.session_id,
        turn: msg.turn,
        cumulative_cost_usd: msg.cumulative_cost_usd,
        cumulative_tokens: msg.cumulative_tokens,
      });
      return null;
    }

    case "tool_call": {
      send({ type: "tool_call", session_id: msg.session_id, tool_call: msg.tool_call });
      return null;
    }

    case "tool_result": {
      send({ type: "tool_result", session_id: msg.session_id, tool_call_id: msg.tool_call_id, output: msg.output });
      return null;
    }

    case "approval_required": {
      pendingApprovalDetails.set(msg.tool_call_id, {
        session_id: msg.session_id,
        tool_name: msg.tool_name,
        tool_input: msg.tool_input,
      });

      send({
        type: "approval_required",
        session_id: msg.session_id,
        tool_call_id: msg.tool_call_id,
        tool_name: msg.tool_name,
        tool_input: msg.tool_input,
      });

      const promise = new Promise<boolean>((resolve) => {
        if (agentWs) {
          // WS path: callback sends response back to the agent socket.
          pendingApprovals.set(msg.tool_call_id, (approved) => {
            agentWs.send(JSON.stringify({ type: "approval_response", tool_call_id: msg.tool_call_id, approved }));
            resolve(approved);
          });
        } else {
          // HTTP path: caller awaits this promise and returns it in the response.
          pendingApprovals.set(msg.tool_call_id, resolve);
        }
      });

      return promise;
    }

    case "session_complete": {
      const s = sessions.get(msg.session_id);
      if (s) {
        s.status = "complete";
        s.completed_at = Date.now();
        s.result_text = msg.result_text;
        s.total_cost_usd = msg.total_cost_usd;
        s.total_tokens = msg.total_tokens;
        s.total_turns = msg.total_turns;
      }
      agentConnections.delete(msg.session_id);
      send({
        type: "session_complete",
        session_id: msg.session_id,
        total_cost_usd: msg.total_cost_usd,
        total_tokens: msg.total_tokens,
        total_turns: msg.total_turns,
        result_text: msg.result_text,
      });
      return null;
    }

    case "session_errored": {
      const s = sessions.get(msg.session_id);
      if (s) {
        s.status = "errored";
        s.completed_at = Date.now();
        s.error_type = msg.error_type;
        s.error_message = msg.error_message;
      }
      agentConnections.delete(msg.session_id);
      send({ type: "session_errored", session_id: msg.session_id, error_type: msg.error_type, error_message: msg.error_message });
      return null;
    }

    case "session_killed": {
      const s = sessions.get(msg.session_id);
      if (s) {
        s.status = "killed";
        s.completed_at = Date.now();
        s.kill_reason = msg.reason;
      }
      agentConnections.delete(msg.session_id);
      send({ type: "session_killed", session_id: msg.session_id, reason: msg.reason });
      return null;
    }

    default:
      return null;
  }
}
