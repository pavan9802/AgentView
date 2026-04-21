# AgentView

Real-time observability dashboard for AI agent sessions. See token usage, cost, tool calls, latency, and context fill as your agent runs — and optionally gate tool use behind dashboard approval.

## Monorepo structure

```
agentview/
  server/            Bun server — WebSocket hub, HTTP ingest endpoint
  dashboard/         React UI — runs locally via Vite dev server
  shared/            TypeScript types shared across packages
  reporter/          @agentview/reporter — SDK wrapper for custom agents
  claude-code-hook/  agentview-hook CLI — bridges Claude Code hooks to the dashboard
```

---

## Watching Claude Code sessions

This is the zero-code path. Every Claude Code session you run on your machine streams to the dashboard automatically via process hooks.

### 1. Start the server

```bash
cd server
bun run dev
# AgentView server — http://localhost:3000
```

### 2. Start the dashboard

```bash
cd dashboard
bun run dev
# Local:   http://localhost:5173
```

Open `http://localhost:5173` in your browser.

### 3. Configure Claude Code hooks

Add the following to `~/.claude/settings.json` (global, applies to every Claude Code session) — replace `/path/to/agentview` with the absolute path to this repo:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun run /path/to/agentview/claude-code-hook/src/index.ts PreToolUse",
            "timeout": 60,
            "statusMessage": "Checking AgentView approval..."
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun run /path/to/agentview/claude-code-hook/src/index.ts PostToolUse",
            "async": true
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun run /path/to/agentview/claude-code-hook/src/index.ts UserPromptSubmit",
            "async": true
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun run /path/to/agentview/claude-code-hook/src/index.ts Stop"
          }
        ]
      }
    ]
  }
}
```

What each hook does:

| Hook | Behaviour |
|---|---|
| `UserPromptSubmit` | Sends your prompt to the dashboard — creates the session entry with the real prompt text |
| `PostToolUse` | Streams each tool call and its output to the dashboard (async, never blocks Claude) |
| `PreToolUse` | Long-polls until you approve or reject the tool in the dashboard (only for tools in `AGENTVIEW_APPROVAL_TOOLS`) |
| `Stop` | Marks the session complete and cleans up state |

### 4. Control which tools need approval

By default `Bash` and `Write` require dashboard approval before Claude can run them. Change this with an env var:

```bash
# Require approval for Bash and Edit only
AGENTVIEW_APPROVAL_TOOLS=Bash,Edit claude "refactor the auth module"

# Disable approval entirely (observe-only)
AGENTVIEW_APPROVAL_TOOLS= claude "read the codebase and summarise it"
```

Or set it permanently in your shell profile:

```bash
export AGENTVIEW_APPROVAL_TOOLS=Bash,Write
```

### 5. Use a different server URL

If the server is running on a non-default port or host:

```bash
AGENTVIEW_URL=http://localhost:4000 claude "your prompt"
```

---

## Using the reporter SDK (custom agents)

If you're building your own agent with the Claude Agent SDK, wrap it with `createReporter` instead of hooking into Claude Code.

### Install

```bash
bun add @agentview/reporter
```

### Usage

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createReporter } from "@agentview/reporter";

const reporter = createReporter({
  serverUrl: "http://localhost:3000",
  prompt: "your task prompt",
  approvalRequiredTools: ["Bash", "Write"], // optional, defaults to ["Bash", "Write"]
});

try {
  const q = query({
    prompt: "your task prompt",
    options: {
      hooks: reporter.hooks,
      canUseTool: reporter.canUseTool,
    },
  });

  for await (const message of q) {
    reporter.handleMessage(message);
  }

  await reporter.complete();
} catch (err) {
  await reporter.error(err);
} finally {
  reporter.close();
}
```

The reporter connects to the server over WebSocket (`/agent-ws`) and streams all events in real time. Approval flow works the same as with Claude Code — the dashboard gates the tool and the `canUseTool` callback blocks until you respond.

### Reporter options

| Option | Type | Default | Description |
|---|---|---|---|
| `serverUrl` | `string` | — | AgentView server base URL |
| `prompt` | `string` | — | Prompt shown as the session name in the dashboard |
| `cwd` | `string` | `process.cwd()` | Working directory shown in the session header |
| `approvalRequiredTools` | `string[]` | `["Bash", "Write"]` | Tools that pause for dashboard approval |
| `inputCostPerToken` | `number` | Haiku 4.5 pricing | Cost per input token in USD |
| `outputCostPerToken` | `number` | Haiku 4.5 pricing | Cost per output token in USD |
| `contextWindowTokens` | `number` | `200_000` | Max context size for fill-% calculation |

---

## Sending follow-up prompts mid-session

While a session is running you can inject a follow-up message from the dashboard's prompt bar at the bottom of the feed panel. The message is streamed into the live agent loop without interrupting it.

You can also send follow-ups via the REST API:

```bash
curl -X POST http://localhost:3000/session/<session_id>/turn \
  -H "Content-Type: application/json" \
  -d '{"prompt": "actually, also update the tests"}'
```

If the session has already finished, the same endpoint resumes it from where it left off using the SDK's resume feature.

---

## Dashboard overview

| Panel | What it shows |
|---|---|
| Sidebar | All sessions, sorted newest first. Running sessions show a live cost ticker. |
| Feed | Chronological stream of your prompts, turn markers, and tool calls with durations. |
| Right panel — Alerts | Pending tool approvals. Approve or reject each one. |
| Right panel — Charts | Token usage over turns, tool call breakdown, latency per turn. |
| Header | Session status, total turns, elapsed time, context window fill %. |

---

## Environment variables (server)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP/WebSocket port |
| `BUDGET_USD` | `0.5` | Per-session cost cap — session is killed when exceeded (SDK runner only) |
| `MAX_TURNS` | `50` | Per-session turn cap (SDK runner only) |
| `ANTHROPIC_API_KEY` | — | Required only for the built-in SDK runner (`POST /session`). Not needed for the hook or reporter paths. |
