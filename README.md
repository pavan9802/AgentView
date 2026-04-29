# AgentView

Real-time observability for AI agent sessions powered by the Anthropic Claude Agent SDK. Monitor token usage, cost, tool calls, latency, and context window fill as your agent runs — from a live dashboard in your browser.

Supports two session modes:
- **SDK sessions** — AgentView runs the agent loop directly
- **Claude Code sessions** — a hook script bridges your existing Claude Code terminal sessions into the dashboard

---

## Quick Start

**Prerequisites:** [Bun](https://bun.sh) installed.

```bash
git clone https://github.com/pavan9802/AgentView
cd AgentView
bun install
```

Create `server/.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Start the server:
```bash
cd server && bun run dev
```

Open the hosted dashboard at **https://agentview.dev** (or run `cd dashboard && bun run dev` for local).

---

## Running SDK Sessions

With the server running, type a prompt into the dashboard's prompt bar and press **RUN**. AgentView starts an agent loop on your machine using the Claude Agent SDK, streams every event to the dashboard in real time, and displays turn metrics, tool calls, and cost as they happen.

To inject follow-up instructions into a running session, type into the prompt bar and press **INJECT**.

---

## Claude Code Integration

Connect your existing Claude Code terminal sessions to the dashboard so you get the same visibility — token usage, cost, tool calls, approval flow — without changing how you work.

### Prerequisites

- AgentView server running (`bun run dev` in `server/`)
- [Bun](https://bun.sh) available in your `PATH`

### Hook Config

When the server starts it prints the exact config block to paste. It looks like this (with the resolved path filled in):

```json
{
  "hooks": {
    "SessionStart":       [{ "hooks": [{ "type": "command", "command": "bun /path/to/hooks/claude-code-hook.ts", "async": true }] }],
    "UserPromptSubmit":   [{ "hooks": [{ "type": "command", "command": "bun /path/to/hooks/claude-code-hook.ts", "async": true }] }],
    "PreToolUse":         [{ "hooks": [{ "type": "command", "command": "bun /path/to/hooks/claude-code-hook.ts" }] }],
    "PostToolUse":        [{ "hooks": [{ "type": "command", "command": "bun /path/to/hooks/claude-code-hook.ts", "async": true }] }],
    "PostToolUseFail":    [{ "hooks": [{ "type": "command", "command": "bun /path/to/hooks/claude-code-hook.ts", "async": true }] }],
    "Stop":               [{ "hooks": [{ "type": "command", "command": "bun /path/to/hooks/claude-code-hook.ts", "async": true }] }],
    "SessionEnd":         [{ "hooks": [{ "type": "command", "command": "bun /path/to/hooks/claude-code-hook.ts", "async": true }] }]
  }
}
```

Paste this into `.claude/settings.json` in your project, or into `~/Library/Application Support/Claude/claude_code_config.json` for global config.

`PreToolUse` is synchronous (no `async: true`) so the hook can block Claude Code for approval. All other hooks are async and never delay your terminal.

### Approval Flow

Tools that require approval (determined by Claude Code's `permission_mode`) show an approval card in the dashboard's Metrics tab. Claude Code waits up to 55 seconds for a decision. If no decision arrives in time, the tool is auto-denied.

Approval requirements can be adjusted after session start via the dashboard's approval config controls.

### Kill Control

Click the **✕** kill button next to a running Claude Code session in the sidebar. The session is flagged and Claude Code is sent a deny decision at the next tool call boundary — the current tool finishes before the stop takes effect.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required. Never leaves your machine. |
| `PORT` | `3000` | Port the AgentView server listens on. |
| `AGENTVIEW_URL` | `http://localhost:3000` | Override in the hook script if your server runs on a different port. |

---

## Known Limitations

- **`/compact`** — session continues under the same session ID; the dashboard treats it as a continuation, not a new session.
- **Kill timing** — kill only takes effect at the next tool call boundary. The agent may complete its current action before stopping.
- **`result_text`** — Claude Code does not expose a final result string via hooks, so completed CC sessions show an empty result rather than a summary.
