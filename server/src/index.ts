/**
 * Stage 1 spike — trigger a real Claude Agent SDK session and log everything.
 *
 * Tasks covered:
 *   1.1  Minimal Bun HTTP server with POST /session
 *   1.2  Wire endpoint to the Agent SDK query loop (ANTHROPIC_API_KEY from env)
 *   1.3  Instrument every available hook and log raw payloads
 *   1.4  Log every message from the async iterator including usage and turn data
 *
 * Goal: observe the exact shapes the SDK surfaces before defining any types,
 * schema, or protocol. All decisions in Stage 2 are derived from this output.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... bun run src/index.ts
 *   curl -X POST http://localhost:3000/session \
 *        -H "Content-Type: application/json" \
 *        -d '{"prompt":"list the TypeScript files in this project","cwd":"/path/to/project"}'
 */

import { query, type HookCallback } from "@anthropic-ai/claude-agent-sdk";



const PORT = Number(process.env["PORT"] ?? 3000);

// ─── 1.3 — Hook factory ───────────────────────────────────────────────────────
// Every hook logs its full raw input with a clear label. No filtering, no
// transformation — the goal is to see exactly what the SDK gives us.
//
// HookCallback signature: (input, toolUseID, context) => Promise<HookOutput>
// We ignore toolUseID and context here since observation is the only goal.

const makeHook =
  (label: string): HookCallback =>
  (input, _toolUseID, _context) => {
    console.log(`\n[hook:${label}]`);
    console.log(JSON.stringify(input, null, 2));
    return Promise.resolve({});
  };

// All hook events use { matcher?, hooks: HookCallback[] }[].
// Omitting matcher causes the hook to fire on every tool call / every event.
const allHooks = {
  // Tool-lifecycle — fire around every tool call
  PreToolUse: [{ hooks: [makeHook("PreToolUse")] }],
  PostToolUse: [{ hooks: [makeHook("PostToolUse")] }],
  PostToolUseFailure: [{ hooks: [makeHook("PostToolUseFailure")] }],

  // Session lifecycle
  SessionStart: [{ hooks: [makeHook("SessionStart")] }],
  SessionEnd: [{ hooks: [makeHook("SessionEnd")] }],

  // Agent execution events
  Stop: [{ hooks: [makeHook("Stop")] }],
  Notification: [{ hooks: [makeHook("Notification")] }],
  UserPromptSubmit: [{ hooks: [makeHook("UserPromptSubmit")] }],
  SubagentStart: [{ hooks: [makeHook("SubagentStart")] }],
  SubagentStop: [{ hooks: [makeHook("SubagentStop")] }],
  PreCompact: [{ hooks: [makeHook("PreCompact")] }],
};

// ─── 1.2 + 1.4 — Session runner ──────────────────────────────────────────────
// Runs the SDK query loop to completion.
// Every message from the async iterator is logged in full — usage fields, stop
// reason, content blocks, and anything else the SDK exposes.

async function runSession(prompt: string, cwd: string): Promise<void> {
  console.log("\n═══════════════════ SESSION START ════════════════════");
  console.log("prompt :", prompt);
  console.log("cwd    :", cwd);
  console.log("══════════════════════════════════════════════════════\n");

  try {
    let index = 0;

    for await (const message of query({
      prompt,
      options: {
        cwd,
        // Allow a representative set of tools to observe all hook types.
        // Write and Edit are included to trigger file-modification hooks.
        allowedTools: ["Read", "Glob", "Grep", "Write", "Edit"],
        // acceptEdits avoids interactive permission prompts blocking the loop.
        permissionMode: "acceptEdits",
        hooks: allHooks,
        // Haiku 4.5 is the smallest, fastest, cheapest model — ideal for the spike.
        model: "claude-haiku-4-5",
      },
    })) {
      // ── 1.4 — Log every message with its type tag ──────────────────────────
      const tag = "type" in message ? `type=${String(message.type)}` : "result";
      console.log(`\n─── message #${index++} [${tag}] ───`);

      // Full raw message — all fields, including usage, stop_reason, content blocks
      console.log(JSON.stringify(message, null, 2));

      // Extra callout for the terminal result so it's easy to locate in the log
      if ("result" in message) {
        console.log("\n═══════════════════ SESSION END ══════════════════════");
        console.log("stop_reason :", message.stop_reason);
        // Truncate long results to keep the terminal readable
        console.log("result      :", String(message.result).slice(0, 500));
        console.log("══════════════════════════════════════════════════════\n");
      }
    }
  } catch (err) {
    console.error("\n[session:error]", err);
  }
}

// ─── 1.1 — HTTP server ────────────────────────────────────────────────────────
// Single endpoint: POST /session { prompt: string, cwd: string }
// No auth, no validation, no database — just enough to trigger a session.

interface SessionBody {
  prompt: string;
  cwd: string;
}

const server = Bun.serve({
  port: PORT,

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/session") {
      // req.json() returns `any` in bun-types. Request body validation is
      // deliberately omitted at this spike stage (see PLAN.md Stage 1.1).
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const body: SessionBody = await req.json();

      // Fire and forget — session runs in the background; all events go to stdout.
      // void is the explicit discard pattern required by no-floating-promises.
      void runSession(body.prompt, body.cwd);

      return new Response(JSON.stringify({ ok: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
});

console.log(`\nAgentView spike — http://localhost:${server.port}`);
console.log("Requires: ANTHROPIC_API_KEY environment variable");
console.log("");
console.log("  curl -X POST http://localhost:3000/session \\");
console.log('    -H "Content-Type: application/json" \\');
console.log('    -d \'{"prompt":"list the TypeScript files","cwd":"/path/to/project"}\'');
console.log("");
