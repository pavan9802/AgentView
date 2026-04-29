export {};

const SERVER = process.env["AGENTVIEW_URL"] ?? "http://localhost:3000";

const ROUTE: Record<string, string> = {
  SessionStart: "/hook/session-start",
  UserPromptSubmit: "/hook/user-prompt-submit",
  PostToolUse: "/hook/post-tool-use",
  PostToolUseFail: "/hook/post-tool-use-fail",
  Stop: "/hook/stop",
  StopFailure: "/hook/stop-failure",
  SessionEnd: "/hook/session-end",
};

async function readUsageFromTranscript(transcriptPath: string) {
  try {
    const text = await Bun.file(transcriptPath).text();
    const lines = text.split("\n").filter(Boolean).reverse();
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (typeof msg?.usage?.input_tokens === "number") {
          return {
            input_tokens: msg.usage.input_tokens,
            output_tokens: msg.usage.output_tokens ?? 0,
            cache_creation_input_tokens: msg.usage.cache_creation_input_tokens ?? 0,
            cache_read_input_tokens: msg.usage.cache_read_input_tokens ?? 0,
          };
        }
      } catch {}
    }
  } catch {}
  return null;
}

async function fireAndForget(path: string, body: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${SERVER}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {}
}

async function sendPreToolUse(body: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(`${SERVER}/hook/pre-tool-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(58_000),
    });
    const json = (await res.json()) as { decision?: string };
    if (json.decision === "deny") {
      process.stdout.write(JSON.stringify({ decision: "deny" }));
    }
  } catch {}
}

try {
  const raw = await Bun.stdin.text();
  const event = JSON.parse(raw) as Record<string, unknown>;
  const { hook_event_name, ...body } = event;

  if (hook_event_name === "PreToolUse") {
    await sendPreToolUse(body);
  } else if (hook_event_name === "Stop" && typeof body["transcript_path"] === "string") {
    const usage = await readUsageFromTranscript(body["transcript_path"]);
    if (usage) body["usage"] = usage;
    await fireAndForget(ROUTE[hook_event_name as string] ?? "", body);
  } else {
    const path = ROUTE[hook_event_name as string];
    if (path) await fireAndForget(path, body);
  }
} catch {}

process.exit(0);
