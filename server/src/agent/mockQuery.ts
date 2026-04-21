type HookMatcher = { hooks: Array<(input: unknown) => Promise<{ continue: boolean }>> };

type MockQueryOptions = {
  abortController?: AbortController;
  hooks?: {
    SessionStart?: HookMatcher[];
    PreToolUse?: HookMatcher[];
    PostToolUse?: HookMatcher[];
    PostToolUseFailure?: HookMatcher[];
    Stop?: HookMatcher[];
  };
  canUseTool?: (
    toolName: string,
    input: unknown,
    ctx: { toolUseID: string },
  ) => Promise<{ behavior: "allow" | "deny"; message?: string }>;
  [key: string]: unknown;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      },
      { once: true },
    );
  });
}

async function callHooks(matchers: HookMatcher[] | undefined, input: unknown): Promise<void> {
  if (!matchers) return;
  for (const matcher of matchers) {
    for (const hook of matcher.hooks) await hook(input);
  }
}

async function runMockTool(
  toolName: string,
  toolInput: Record<string, string>,
  toolResponse: string,
  options: MockQueryOptions,
  simulateFailure?: string,
): Promise<void> {
  const signal = options.abortController?.signal;
  const toolUseId = crypto.randomUUID();

  await callHooks(options.hooks?.PreToolUse, {
    tool_use_id: toolUseId,
    tool_name: toolName,
    tool_input: toolInput,
  });

  if (options.canUseTool) {
    const result = await options.canUseTool(toolName, toolInput, { toolUseID: toolUseId });
    if (result.behavior === "deny") {
      // Still call PostToolUse so the dashboard gets a result for this tool call
      await callHooks(options.hooks?.PostToolUse, {
        tool_use_id: toolUseId,
        tool_name: toolName,
        tool_input: toolInput,
        tool_response: "Denied by user.",
      });
      return;
    }
  }

  await sleep(400 + Math.random() * 600, signal);

  if (simulateFailure) {
    await callHooks(options.hooks?.PostToolUseFailure, {
      tool_use_id: toolUseId,
      tool_name: toolName,
      tool_input: toolInput,
      error: simulateFailure,
    });
    return;
  }

  await callHooks(options.hooks?.PostToolUse, {
    tool_use_id: toolUseId,
    tool_name: toolName,
    tool_input: toolInput,
    tool_response: toolResponse,
  });
}

type MockQueryResult = AsyncIterable<unknown> & {
  streamInput: (queue: AsyncIterable<unknown>) => Promise<void>;
};

export function mockQuery(params: {
  prompt: string;
  options: MockQueryOptions;
}): MockQueryResult {
  const gen = mockQueryGen(params);
  return {
    [Symbol.asyncIterator]() {
      return gen;
    },
    // No-op: the mock scenario is fixed, injected prompts are silently ignored.
    async streamInput(_queue: AsyncIterable<unknown>): Promise<void> {},
  };
}

async function* mockQueryGen(params: {
  prompt: string;
  options: MockQueryOptions;
}): AsyncGenerator<unknown> {
  const { prompt, options } = params;
  const signal = options.abortController?.signal;

  console.log("[mock-sdk] starting mock session for prompt:", prompt);

  const mockSessionId = `mock-session-${crypto.randomUUID()}`;
  await callHooks(options.hooks?.SessionStart, {
    hook_event_name: "SessionStart",
    session_id: mockSessionId,
    source: (options as { resume?: string }).resume ? "resume" : "startup",
  });

  // --- Turn 1 ---
  await sleep(300, signal);
  await runMockTool("Read", { file_path: "src/index.ts" }, "// entry point\nexport {};", options);
  await sleep(200, signal);
  await runMockTool(
    "Glob",
    { pattern: "**/*.ts" },
    "src/index.ts\nsrc/utils.ts\nsrc/types.ts",
    options,
  );

  // Turn 1 usage (triggers turn_update + cost tracking in handleTurnUsage)
  yield { usage: { input_tokens: 1_200, output_tokens: 180 } };
  await sleep(400, signal);

  // --- Turn 2 ---
  await runMockTool(
    "Grep",
    { pattern: "export", path: "src/" },
    "src/index.ts:1:export {};",
    options,
  );
  await sleep(200, signal);
  await runMockTool(
    "Edit",
    { file_path: "src/index.ts", old_string: "// entry point", new_string: "// updated entry point" },
    "File updated successfully.",
    options,
  );
  await sleep(200, signal);
  await runMockTool(
    "Write",
    { file_path: "/read-only/config.json", content: "{}" },
    "",
    options,
    "EACCES: permission denied, open '/read-only/config.json'",
  );
  await sleep(200, signal);
  // Bash requires approval by default — canUseTool will pause and send approval_required
  await runMockTool("Bash", { command: "echo 'build complete'" }, "build complete", options);

  // Turn 2 usage
  yield { usage: { input_tokens: 2_500, output_tokens: 340 } };
  await sleep(400, signal);

  // Final assistant message — runner extracts this as result_text
  yield {
    role: "assistant",
    content: [
      {
        type: "text",
        text: `[MOCK] Task complete: "${prompt}"\n\nRead and updated the relevant source files. All operations succeeded.`,
      },
    ],
  };

  await callHooks(options.hooks?.Stop, { hook_event_name: "Stop" });

  console.log("[mock-sdk] mock session complete");
}
