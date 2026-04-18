import type { CanUseTool, HookCallbackMatcher } from "@anthropic-ai/claude-agent-sdk";
import type { AgentToServer, ServerToAgent } from "@agentview/shared";
import type { Turn, ToolCall } from "@agentview/shared";

// Haiku 4.5 pricing — used when model is not specified or is the default.
const DEFAULT_INPUT_COST = 1e-6;
const DEFAULT_OUTPUT_COST = 5e-6;

export type ReporterOptions = {
  /** Base URL of the AgentView server, e.g. "http://localhost:3000". */
  serverUrl: string;
  /** The prompt for this session (shown in the dashboard). */
  prompt: string;
  /** Working directory — defaults to process.cwd(). */
  cwd?: string;
  /** Tools that need dashboard approval before running. Defaults to ["Bash", "Write"]. */
  approvalRequiredTools?: string[];
  /** Cost per input token in USD. Defaults to Haiku 4.5 pricing. */
  inputCostPerToken?: number;
  /** Cost per output token in USD. Defaults to Haiku 4.5 pricing. */
  outputCostPerToken?: number;
  /** Max context window size for fill-% calculation. Defaults to 200_000. */
  contextWindowTokens?: number;
};

export type Reporter = {
  readonly sessionId: string;
  /** Pass these directly into query()'s options.hooks. */
  readonly hooks: {
    PreToolUse: [HookCallbackMatcher];
    PostToolUse: [HookCallbackMatcher];
    Stop: [HookCallbackMatcher];
  };
  /** Pass this directly into query()'s options.canUseTool. */
  readonly canUseTool: CanUseTool;
  /**
   * Call this for every message yielded by the query() generator.
   * Tracks token usage and sends turn_update events to the dashboard.
   */
  handleMessage(msg: unknown): void;
  /** Call after the for-await loop exits normally. */
  complete(resultText?: string): Promise<void>;
  /** Call in the catch block if the agent throws. */
  error(err: unknown): Promise<void>;
  /** Close the underlying WebSocket. Call in a finally block. */
  close(): void;
};

export function createReporter(options: ReporterOptions): Reporter {
  const sessionId = crypto.randomUUID();
  const wsUrl = options.serverUrl.replace(/^http/, "ws") + "/agent-ws";
  const approvalRequiredTools = options.approvalRequiredTools ?? ["Bash", "Write"];
  const inputCost = options.inputCostPerToken ?? DEFAULT_INPUT_COST;
  const outputCost = options.outputCostPerToken ?? DEFAULT_OUTPUT_COST;
  const contextWindow = options.contextWindowTokens ?? 200_000;

  const ws = new WebSocket(wsUrl);
  const pendingApprovals = new Map<string, (approved: boolean) => void>();
  const toolTimestamps = new Map<string, number>();

  // Internal loop state — mirrors server/src/agent/handlers/turnUsage.ts
  const loop = {
    turnId: crypto.randomUUID(),
    turnStartedAt: Date.now(),
    turnNumber: 0,
    totalCost: 0,
    totalTokens: 0,
    resultText: "",
  };

  ws.onmessage = (event: MessageEvent) => {
    let msg: ServerToAgent;
    try {
      msg = JSON.parse(event.data as string) as ServerToAgent;
    } catch {
      return;
    }
    if (msg.type === "approval_response") {
      const resolve = pendingApprovals.get(msg.tool_call_id);
      if (resolve) {
        pendingApprovals.delete(msg.tool_call_id);
        resolve(msg.approved);
      }
    }
    // "kill" messages: the caller's AbortController handles termination;
    // nothing extra needed here since the SDK will throw AbortError.
  };

  const ready = new Promise<void>((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
    } else {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("AgentView: could not connect to server at " + wsUrl));
    }
  });

  // Register the session as soon as the socket is open.
  void ready.then(() => {
    send({
      type: "session_started",
      session_id: sessionId,
      prompt: options.prompt,
      cwd: options.cwd ?? (typeof process !== "undefined" ? process.cwd() : "/"),
      created_at: Date.now(),
      approval_required_tools: approvalRequiredTools,
    });
  });

  function send(msg: AgentToServer) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  return {
    sessionId,

    hooks: {
      PreToolUse: [
        {
          hooks: [
            async (input) => {
              const { tool_use_id } = input as { tool_use_id: string };
              toolTimestamps.set(tool_use_id, Date.now());
              return { continue: true };
            },
          ],
        },
      ],

      PostToolUse: [
        {
          hooks: [
            async (input) => {
              const msg = input as {
                tool_use_id: string;
                tool_name: string;
                tool_input: unknown;
                tool_response: unknown;
              };
              const duration_ms = Date.now() - (toolTimestamps.get(msg.tool_use_id) ?? Date.now());
              toolTimestamps.delete(msg.tool_use_id);

              const toolCall: ToolCall = {
                id: msg.tool_use_id,
                session_id: sessionId,
                turn_id: loop.turnId,
                tool_name: msg.tool_name,
                tool_input: JSON.stringify(msg.tool_input),
                duration_ms,
                approved: approvalRequiredTools.includes(msg.tool_name) ? true : null,
                error: null,
                created_at: Date.now(),
              };

              await ready;
              send({ type: "tool_call", session_id: sessionId, tool_call: toolCall });

              const output =
                typeof msg.tool_response === "string"
                  ? msg.tool_response
                  : JSON.stringify(msg.tool_response);
              send({ type: "tool_result", session_id: sessionId, tool_call_id: toolCall.id, output });

              return { continue: true };
            },
          ],
        },
      ],

      Stop: [
        {
          hooks: [
            async (input) => {
              // Extract result text from the stop hook if provided.
              const stop = input as { result?: string };
              if (stop.result) loop.resultText = stop.result;
              return { continue: true };
            },
          ],
        },
      ],
    },

    canUseTool: async (toolName, input, { toolUseID }) => {
      if (!approvalRequiredTools.includes(toolName)) {
        return { behavior: "allow" };
      }

      await ready;
      send({
        type: "approval_required",
        session_id: sessionId,
        tool_call_id: toolUseID,
        tool_name: toolName,
        tool_input: JSON.stringify(input),
      });

      const approved = await new Promise<boolean>((resolve) => {
        pendingApprovals.set(toolUseID, resolve);
      });

      return approved ? { behavior: "allow" } : { behavior: "deny", message: "User rejected" };
    },

    handleMessage(msg: unknown) {
      if (typeof msg !== "object" || msg === null || !("usage" in msg)) return;
      const usage = (msg as { usage: unknown }).usage;
      if (typeof usage !== "object" || usage === null) return;

      const { input_tokens, output_tokens } = usage as {
        input_tokens?: number;
        output_tokens?: number;
      };

      // Also capture assistant text for the session_complete result_text.
      if ("role" in msg && (msg as { role: unknown }).role === "assistant" && "content" in msg) {
        const content = (msg as { content: unknown[] }).content;
        if (Array.isArray(content)) {
          const texts = content
            .filter(
              (b): b is { type: string; text: string } =>
                typeof b === "object" && b !== null && "type" in b &&
                (b as { type: unknown }).type === "text",
            )
            .map((b) => b.text);
          if (texts.length > 0) loop.resultText = texts.join("\n");
        }
      }

      const inputTok = input_tokens ?? 0;
      const outputTok = output_tokens ?? 0;
      const cost_usd = inputTok * inputCost + outputTok * outputCost;
      const context_fill_pct = Math.min((inputTok / contextWindow) * 100, 100);
      const latency_ms = Date.now() - loop.turnStartedAt;

      loop.turnNumber += 1;
      loop.totalTokens += inputTok + outputTok;
      loop.totalCost += cost_usd;

      const turn: Turn = {
        id: loop.turnId,
        session_id: sessionId,
        turn_number: loop.turnNumber,
        input_tokens: inputTok,
        output_tokens: outputTok,
        cost_usd,
        context_fill_pct,
        latency_ms,
        created_at: Date.now(),
      };

      loop.turnId = crypto.randomUUID();
      loop.turnStartedAt = Date.now();

      send({
        type: "turn_update",
        session_id: sessionId,
        turn,
        cumulative_cost_usd: loop.totalCost,
        cumulative_tokens: loop.totalTokens,
      });
    },

    async complete(resultText?: string) {
      await ready;
      send({
        type: "session_complete",
        session_id: sessionId,
        total_cost_usd: loop.totalCost,
        total_tokens: loop.totalTokens,
        total_turns: loop.turnNumber,
        result_text: resultText ?? loop.resultText,
      });
    },

    async error(err: unknown) {
      await ready;
      const message = err instanceof Error ? err.message : String(err);
      send({
        type: "session_errored",
        session_id: sessionId,
        error_type: "api_unavailable",
        error_message: message,
      });
    },

    close() {
      ws.close();
    },
  };
}
