#!/usr/bin/env bun
/**
 * agentview-hook — Claude Code hook bridge for AgentView dashboard.
 *
 * Claude Code runs this binary for each hook event (PreToolUse, PostToolUse, etc.)
 * by spawning a new process and passing the event payload via stdin as JSON. This
 * script reads that payload, translates it into an AgentView ingest event, and
 * POSTs it to the local AgentView server so the dashboard can display it.
 *
 * Usage in .claude/settings.json:
 *
 *   {
 *     "hooks": {
 *       "PreToolUse":       [{ "command": "agentview-hook PreToolUse"       }],
 *       "PostToolUse":      [{ "command": "agentview-hook PostToolUse"      }],
 *       "Stop":             [{ "command": "agentview-hook Stop"             }],
 *       "UserPromptSubmit": [{ "command": "agentview-hook UserPromptSubmit" }],
 *       "SessionStart":     [{ "matcher": "clear", "command": "agentview-hook SessionStart" }]
 *     }
 *   }
 *
 * Environment variables:
 *   AGENTVIEW_URL           — AgentView server base URL (default: http://localhost:3000)
 *   AGENTVIEW_APPROVAL_TOOLS — Comma-separated tools requiring dashboard approval (default: Bash,Write)
 *
 * Exit codes:
 *   0  — hook handled successfully (tool is allowed for PreToolUse)
 *   2  — tool rejected by dashboard (PreToolUse approval denied)
 *   1  — unexpected error
 */

// ── Config ─────────────────────────────────────────────────────────────────
// Read from environment so users can point at a non-default server port and
// change which tools require explicit dashboard approval.

const AGENTVIEW_URL = process.env["AGENTVIEW_URL"] ?? "http://localhost:3000";
const INGEST = `${AGENTVIEW_URL}/ingest`;
const APPROVAL_TOOLS = (process.env["AGENTVIEW_APPROVAL_TOOLS"] ?? "Bash,Write")
  .split(",")
  .map((s: string) => s.trim());

// ── Claude Code hook input shapes ──────────────────────────────────────────
// Claude Code pipes a JSON object matching one of these types to stdin,
// depending on which hook event fired.

type PreToolUseInput = {
  session_id: string;
  tool_use_id?: string; // stable across Pre/PostToolUse for the same call — used to correlate approval_required with tool_call
  tool_name: string;
  tool_input: Record<string, unknown>;
};

type PostToolUseInput = {
  session_id: string;
  tool_use_id?: string; // stable across Pre/PostToolUse for the same call — used to correlate approval_required with tool_call
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: unknown;
};

type UserPromptSubmitInput = {
  session_id: string;
  prompt: string;
};

type SessionStartInput = {
  session_id: string;
  cwd: string;
  source: string; // "startup" | "clear" | "resume" | ...
};

type StopInput = {
  session_id: string;
  stop_hook_active: boolean;
  transcript: Array<{
    role: string;
    content: unknown;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  }>;
};

// ── Text extraction ──────────────────────────────────────────────────────────
// Extract plain text from a transcript message's content field, which can be
// either a raw string or an array of content blocks (Claude API format).

function extractText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter(
        (b): b is { type: string; text: string } =>
          typeof b === "object" && b !== null && (b as Record<string, unknown>)["type"] === "text",
      )
      .map((b) => b.text)
      .join("\n")
      .trim();
  }
  return "";
}

// ── Pricing ─────────────────────────────────────────────────────────────────
// Claude Sonnet pricing (per million tokens). Used to compute per-turn cost
// from the usage block in the Stop hook's transcript.

const COST_PER_M_INPUT = 3.0;
const COST_PER_M_OUTPUT = 15.0;
const COST_PER_M_CACHE_CREATE = 3.75;
const COST_PER_M_CACHE_READ = 0.30;
const CONTEXT_WINDOW = 200_000;

function computeCostUsd(usage: NonNullable<StopInput["transcript"][0]["usage"]>): number {
  return (
    ((usage.input_tokens ?? 0) * COST_PER_M_INPUT) / 1_000_000 +
    ((usage.output_tokens ?? 0) * COST_PER_M_OUTPUT) / 1_000_000 +
    ((usage.cache_creation_input_tokens ?? 0) * COST_PER_M_CACHE_CREATE) / 1_000_000 +
    ((usage.cache_read_input_tokens ?? 0) * COST_PER_M_CACHE_READ) / 1_000_000
  );
}

// ── Per-session turn state ───────────────────────────────────────────────────
// Persisted to {STATE_DIR}/{ccSessionId}.turns so cumulative cost/tokens/count
// survive across hook invocations and can populate session_complete.

type TurnState = { count: number; total_cost_usd: number; total_tokens: number };

async function loadTurnState(ccSessionId: string): Promise<TurnState> {
  const f = Bun.file(`${STATE_DIR}/${ccSessionId}.turns`);
  if (await f.exists()) return f.json() as Promise<TurnState>;
  return { count: 0, total_cost_usd: 0, total_tokens: 0 };
}

async function saveTurnState(ccSessionId: string, state: TurnState): Promise<void> {
  await Bun.write(`${STATE_DIR}/${ccSessionId}.turns`, JSON.stringify(state));
}

// ── Timestamp tracking for latency / duration ────────────────────────────────
// Turn latency  = time from last tool-result (or user prompt) → Stop.
//   Written at UserPromptSubmit and overwritten at each PostToolUse so it
//   always reflects the start of the most recent "Claude thinking" period.
// Tool duration = time from tool approved (end of PreToolUse) → PostToolUse.
//   Keyed by tool_use_id so parallel tool calls don't stomp each other.

function turnStartFile(id: string): string { return `${STATE_DIR}/${id}.turn_start`; }
function toolStartFile(id: string): string { return `${STATE_DIR}/${id}.tool_start`; }

async function writeTurnStart(ccSessionId: string): Promise<void> {
  await Bun.write(turnStartFile(ccSessionId), String(Date.now()));
}

async function readAndClearTurnStart(ccSessionId: string): Promise<number> {
  const f = Bun.file(turnStartFile(ccSessionId));
  if (!(await f.exists())) return 0;
  const ts = parseInt(await f.text(), 10);
  await tryUnlink(turnStartFile(ccSessionId));
  return isNaN(ts) ? 0 : Math.max(0, Date.now() - ts);
}

async function writeToolStart(toolUseId: string): Promise<void> {
  await Bun.write(toolStartFile(toolUseId), String(Date.now()));
}

async function readAndClearToolStart(toolUseId: string): Promise<number> {
  const f = Bun.file(toolStartFile(toolUseId));
  if (!(await f.exists())) return 0;
  const ts = parseInt(await f.text(), 10);
  await tryUnlink(toolStartFile(toolUseId));
  return isNaN(ts) ? 0 : Math.max(0, Date.now() - ts);
}

// ── Claude Code permission helpers ──────────────────────────────────────────
// Read the merged allow-list from Claude Code's settings files so we can skip
// dashboard approval for tool calls that CC itself would auto-approve.

async function getClaudeAllowedPatterns(projectCwd: string): Promise<string[]> {
  const home = process.env["HOME"] ?? "/tmp";
  const files = [
    `${home}/.claude/settings.json`,
    `${home}/.claude/settings.local.json`,
    `${projectCwd}/.claude/settings.json`,
    `${projectCwd}/.claude/settings.local.json`,
  ];
  const patterns: string[] = [];
  for (const file of files) {
    const f = Bun.file(file);
    if (!(await f.exists())) continue;
    try {
      const data = (await f.json()) as { permissions?: { allow?: string[] } };
      patterns.push(...(data.permissions?.allow ?? []));
    } catch { /* ignore malformed settings */ }
  }
  return patterns;
}

// Returns true if one of the CC permission patterns covers this tool call,
// i.e. CC would auto-approve it and never show its own approval UI.
//
// Pattern format used by Claude Code:
//   "ToolName"            — allow all calls to that tool
//   "ToolName(prefix:*)"  — allow calls where the primary argument starts with prefix
//
// For Bash the primary argument is `tool_input.command`.
// For all other tools we check every string value in tool_input.
function matchesClaudePermission(
  toolName: string,
  toolInput: Record<string, unknown>,
  patterns: string[],
): boolean {
  for (const pattern of patterns) {
    const parenIdx = pattern.indexOf("(");

    if (parenIdx === -1) {
      // Bare tool name — allows everything for that tool.
      if (pattern === toolName) return true;
      continue;
    }

    const patternTool = pattern.slice(0, parenIdx);
    if (patternTool !== toolName) continue;

    // Extract the argument pattern, e.g. "npm install:*" from "Bash(npm install:*)".
    const argPattern = pattern.slice(parenIdx + 1, -1);
    // Strip the trailing ":*" or "*" wildcard to get the required prefix.
    const prefix = argPattern.replace(/:?\*$/, "");

    if (toolName === "Bash") {
      const command = String(toolInput["command"] ?? "");
      if (command.startsWith(prefix)) return true;
    } else {
      // For non-Bash tools match against any string field in the input.
      if (!prefix) return true; // bare wildcard — allows all
      for (const val of Object.values(toolInput)) {
        if (typeof val === "string" && val.startsWith(prefix)) return true;
      }
    }
  }
  return false;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// Fire-and-forget POST to the AgentView ingest endpoint.
async function post(body: unknown): Promise<unknown> {
  const res = await fetch(INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Delete a file if it exists, silently skip if it doesn't.
async function tryUnlink(path: string): Promise<void> {
  if (await Bun.file(path).exists()) {
    await Bun.file(path).unlink();
  }
}

// ── Session ID mapping ──────────────────────────────────────────────────────
// Claude Code assigns its own session_id per conversation. We map each CC
// session_id to a stable AgentView session_id, persisted in ~/.agentview/, so
// all hooks fired within the same CC conversation are grouped under one session
// on the dashboard.
//
// Two files are written per active session:
//   {ccSessionId}.json    — the CC → AgentView session_id mapping
//   {ccSessionId}.started — presence flag; deleted after each Stop hook so the
//                           next prompt re-registers the session (handles server
//                           restarts between prompts)
//
// A third file tracks whichever session is currently active:
//   current_session.json  — used by the /clear handler to find and complete the
//                           previous session, since /clear creates a new CC
//                           session_id before this script can look one up

const STATE_DIR = `${process.env["HOME"] ?? "/tmp"}/.agentview`;
const CURRENT_SESSION_FILE = `${STATE_DIR}/current_session.json`;

// Returns the AgentView session_id for a given CC session_id, or null if this
// CC session has never been registered (no .json file on disk).
// Use this from PreToolUse / PostToolUse / Stop — those hooks must not create
// ghost sessions for sub-agents or IDE extension events.
async function getSessionId(ccSessionId: string): Promise<string | null> {
  await Bun.write(`${STATE_DIR}/.keep`, ""); // ensure STATE_DIR exists
  const f = Bun.file(`${STATE_DIR}/${ccSessionId}.json`);
  if (!(await f.exists())) return null;
  const data = (await f.json()) as { agentview_session_id: string };
  return data.agentview_session_id;
}

// Returns the AgentView session_id for a given CC session_id, creating and
// persisting a new one if this is the first hook we've seen for that CC session.
// Only call this from UserPromptSubmit and SessionStart — those are the hooks
// that legitimately open a new session.
async function getOrCreateSessionId(ccSessionId: string): Promise<string> {
  const existing = await getSessionId(ccSessionId);
  if (existing) return existing;
  const id = crypto.randomUUID();
  await Bun.write(`${STATE_DIR}/${ccSessionId}.json`, JSON.stringify({ agentview_session_id: id }));
  return id;
}

// Sends a session_started event to the server the first time a hook fires for
// a given CC session (or after a Stop hook cleared the .started flag). Idempotent
// within a single turn — subsequent calls are no-ops until Stop clears the flag.
async function ensureSessionStarted(
  ccSessionId: string,
  agentviewSessionId: string,
  prompt: string,
  cwd: string,
  allowClearFallback = false,
): Promise<void> {
  const flagFile = `${STATE_DIR}/${ccSessionId}.started`;
  if (await Bun.file(flagFile).exists()) return;

  // Fallback /clear detection: if current_session.json exists but has a different
  // cc_session_id, a new CC session started (e.g. /clear) but the SessionStart hook
  // either didn't fire or ran before this was written. Complete the old session now
  // so the dashboard doesn't show it as running forever.
  //
  // Only run this from UserPromptSubmit (allowClearFallback=true). PreToolUse and
  // PostToolUse can fire from unrelated IDE sessions with a different cc_session_id
  // (e.g. opening a file in the VS Code extension), which would incorrectly complete
  // the active session.
  if (allowClearFallback) {
    const currentSessionFile = Bun.file(CURRENT_SESSION_FILE);
    if (await currentSessionFile.exists()) {
      const current = (await currentSessionFile.json()) as { agentview_session_id: string; cc_session_id: string };
      if (current.cc_session_id !== ccSessionId) {
        const oldTurns = await loadTurnState(current.cc_session_id);
        await post({
          type: "session_complete",
          session_id: current.agentview_session_id,
          total_cost_usd: oldTurns.total_cost_usd,
          total_tokens: oldTurns.total_tokens,
          total_turns: oldTurns.count,
          result_text: "",
        }).catch(() => {});
        await Promise.all([
          tryUnlink(`${STATE_DIR}/${current.cc_session_id}.json`),
          tryUnlink(`${STATE_DIR}/${current.cc_session_id}.started`),
          tryUnlink(`${STATE_DIR}/${current.cc_session_id}.turns`),
          tryUnlink(turnStartFile(current.cc_session_id)),
        ]).catch(() => {});
      }
    }
  }

  await post({
    type: "session_started",
    session_id: agentviewSessionId,
    prompt,
    cwd,
    created_at: Date.now(),
    approval_required_tools: APPROVAL_TOOLS,
  });

  await Bun.write(flagFile, "1");
  // Keep current_session.json up to date so the /clear handler can find this session.
  await Bun.write(CURRENT_SESSION_FILE, JSON.stringify({ agentview_session_id: agentviewSessionId, cc_session_id: ccSessionId }));
}

// ── Entry point ─────────────────────────────────────────────────────────────
// Claude Code passes the hook type as the first CLI argument and the event
// payload as JSON on stdin. Parse both, resolve the session IDs, then dispatch.

const hookType = process.argv[2];
if (!hookType) {
  console.error("agentview-hook: missing hook type argument (PreToolUse | PostToolUse | Stop)");
  process.exit(1);
}

const raw = await Bun.stdin.text();
if (!raw.trim()) process.exit(0);

let input: unknown;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}

// Extract the CC session_id that's present on every hook payload, then look up
// the corresponding AgentView session_id. We intentionally do NOT create a new
// mapping here — only UserPromptSubmit and SessionStart may open new sessions.
// PreToolUse / PostToolUse / Stop bail out silently if the session is unknown,
// which prevents ghost sessions from sub-agents and VS Code extension events.
const ccSessionId = (input as { session_id?: string }).session_id ?? "unknown";
const cwd = (input as { cwd?: string }).cwd ?? process.cwd();

let agentviewSessionId: string | null = await getSessionId(ccSessionId);

// ── Hook dispatch ───────────────────────────────────────────────────────────

switch (hookType) {
  case "PreToolUse": {
    // Fired before every tool call. For tools in APPROVAL_TOOLS, we long-poll
    // the server until the dashboard user approves or rejects. All other tools
    // are allowed immediately without contacting the server.
    if (!agentviewSessionId) process.exit(0); // unknown session (sub-agent / IDE extension), ignore
    const msg = input as PreToolUseInput;
    // Use the stable tool_use_id provided by Claude Code so the approval_required
    // and tool_call messages share the same ID and the dashboard can correlate them.
    const toolUseId = msg.tool_use_id ?? crypto.randomUUID();

    await ensureSessionStarted(ccSessionId, agentviewSessionId, `Claude Code session ${ccSessionId}`, cwd, false);

    if (!APPROVAL_TOOLS.includes(msg.tool_name)) {
      await writeToolStart(toolUseId);
      process.exit(0);
    }

    // If Claude Code's own permissions already cover this call, CC shows no
    // approval UI — so we shouldn't either. Pass straight through.
    const ccPatterns = await getClaudeAllowedPatterns(cwd);
    if (matchesClaudePermission(msg.tool_name, msg.tool_input, ccPatterns)) {
      await writeToolStart(toolUseId);
      process.exit(0);
    }

    // POST blocks until the dashboard responds (or the server times out at 5 min).
    let approved = false;
    try {
      const result = (await post({
        type: "approval_required",
        session_id: agentviewSessionId,
        tool_call_id: toolUseId,
        tool_name: msg.tool_name,
        tool_input: JSON.stringify(msg.tool_input),
      })) as { approved: boolean };
      approved = result.approved;
    } catch {
      // Server unreachable — fail open so the agent isn't stuck waiting forever.
      approved = true;
    }

    if (!approved) {
      // Exit code 2 signals Claude Code to block the tool. Anything written to
      // stdout is passed back to the model as the rejection reason.
      console.log(JSON.stringify({ decision: "block", reason: "Rejected by AgentView dashboard" }));
      process.exit(2);
    }

    // Record the moment approval resolved — this is when the tool actually starts
    // executing. PostToolUse reads it to compute real execution duration.
    await writeToolStart(toolUseId);
    process.exit(0);
  }

  case "PostToolUse": {
    // Fired after every tool call completes. Send the tool call record and its
    // output to the dashboard for display in the session feed.
    if (!agentviewSessionId) process.exit(0); // unknown session (sub-agent / IDE extension), ignore
    const msg = input as PostToolUseInput;
    // Must match the ID used in PreToolUse so the dashboard can remove the
    // pending approval entry when the tool_call message arrives.
    const toolUseId = msg.tool_use_id ?? crypto.randomUUID();

    await ensureSessionStarted(ccSessionId, agentviewSessionId, `Claude Code session ${ccSessionId}`, cwd, false);

    // Compute how long this tool took to execute (PreToolUse end → PostToolUse).
    const durationMs = await readAndClearToolStart(toolUseId);
    // Reset the turn-start clock — latency is measured from the last tool
    // result (or user prompt) to the next Stop hook.
    await writeTurnStart(ccSessionId);

    const output =
      typeof msg.tool_response === "string" ? msg.tool_response : JSON.stringify(msg.tool_response);

    await post({
      type: "tool_call",
      session_id: agentviewSessionId,
      tool_call: {
        id: toolUseId,
        session_id: agentviewSessionId,
        turn_id: crypto.randomUUID(),
        tool_name: msg.tool_name,
        tool_input: JSON.stringify(msg.tool_input),
        duration_ms: durationMs,
        approved: APPROVAL_TOOLS.includes(msg.tool_name) ? true : null,
        error: null,
        created_at: Date.now(),
      },
    }).catch(() => {});

    await post({
      type: "tool_result",
      session_id: agentviewSessionId,
      tool_call_id: toolUseId,
      output,
    }).catch(() => {});

    process.exit(0);
  }

  case "Stop": {
    // Fired after every Claude response. Extract usage from the last assistant
    // message in the transcript and send a turn_update so the dashboard shows
    // live cost, token, and turn-count data.
    if (!agentviewSessionId) process.exit(0); // unknown session (sub-agent / IDE extension), ignore
    const msg = input as StopInput;

    // Find the last assistant message — extract usage metrics and text content.
    let usage: NonNullable<StopInput["transcript"][0]["usage"]> | undefined;
    let assistantText = "";
    for (let i = msg.transcript.length - 1; i >= 0; i--) {
      const m = msg.transcript[i];
      if (m && m.role === "assistant") {
        if (!usage && m.usage) usage = m.usage;
        if (!assistantText) assistantText = extractText(m.content);
        if (usage && assistantText) break;
      }
    }

    if (usage) {
      const inputTokens = usage.input_tokens ?? 0;
      const outputTokens = usage.output_tokens ?? 0;
      const costUsd = computeCostUsd(usage);
      const contextFillPct = Math.min((inputTokens / CONTEXT_WINDOW) * 100, 100);

      const state = await loadTurnState(ccSessionId);
      state.count += 1;
      state.total_cost_usd += costUsd;
      state.total_tokens += inputTokens + outputTokens;
      await saveTurnState(ccSessionId, state);

      await post({
        type: "turn_update",
        session_id: agentviewSessionId,
        turn: {
          id: crypto.randomUUID(),
          session_id: agentviewSessionId,
          turn_number: state.count,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd: costUsd,
          context_fill_pct: contextFillPct,
          latency_ms: await readAndClearTurnStart(ccSessionId),
          created_at: Date.now(),
        },
        cumulative_cost_usd: state.total_cost_usd,
        cumulative_tokens: state.total_tokens,
      }).catch(() => {});

      if (assistantText) {
        await post({
          type: "assistant_message",
          session_id: agentviewSessionId,
          id: crypto.randomUUID(),
          text: assistantText,
          created_at: Date.now(),
        }).catch(() => {});
      }

      // Mark the session complete so the dashboard renders the result bubble.
      // The next UserPromptSubmit re-sends session_started which transitions the
      // session back to "running" and hides the result until Claude responds again.
      await post({
        type: "session_complete",
        session_id: agentviewSessionId,
        total_cost_usd: state.total_cost_usd,
        total_tokens: state.total_tokens,
        total_turns: state.count,
        result_text: assistantText,
      }).catch(() => {});
    }

    // Delete .started so the next UserPromptSubmit re-sends session_started —
    // keeps the session alive across multiple prompts and handles server restarts.
    await tryUnlink(`${STATE_DIR}/${ccSessionId}.started`).catch(() => {});
    process.exit(0);
  }

  case "UserPromptSubmit": {
    // Fired when the user submits a prompt. Registers the session on first call
    // (or after a server restart), then forwards the prompt text to the dashboard.
    const sessionId = agentviewSessionId ?? await getOrCreateSessionId(ccSessionId);
    const msg = input as UserPromptSubmitInput;
    await ensureSessionStarted(ccSessionId, sessionId, msg.prompt, cwd, true);
    // Start the turn-start clock so the first Stop after this prompt gives
    // accurate latency for the initial model response.
    await writeTurnStart(ccSessionId);
    await post({
      type: "user_prompt",
      session_id: sessionId,
      id: crypto.randomUUID(),
      prompt: msg.prompt,
      created_at: Date.now(),
    }).catch(() => {});
    process.exit(0);
  }

  case "SessionStart": {
    // Fired when Claude Code starts a new session. We only care about /clear,
    // which resets the conversation and assigns a new CC session_id — so we
    // complete the previous AgentView session and immediately open a fresh one.
    const msg = input as SessionStartInput;

    if (msg.source !== "clear") {
      process.exit(0);
    }

    // /clear gives us a brand-new CC session_id, so look up the previous AgentView
    // session from current_session.json rather than from the (new) ccSessionId.
    const currentSessionFile = Bun.file(CURRENT_SESSION_FILE);
    if (await currentSessionFile.exists()) {
      const current = (await currentSessionFile.json()) as { agentview_session_id: string; cc_session_id: string };

      // Only complete the previous session if it's actually a different CC session.
      // If the cc_session_ids match, the fallback in ensureSessionStarted already
      // handled this (UserPromptSubmit fired before SessionStart completed) — skip.
      if (current.cc_session_id !== ccSessionId) {
        const oldTurns = await loadTurnState(current.cc_session_id);
        // Mark the previous session complete on the dashboard.
        await post({
          type: "session_complete",
          session_id: current.agentview_session_id,
          total_cost_usd: oldTurns.total_cost_usd,
          total_tokens: oldTurns.total_tokens,
          total_turns: oldTurns.count,
          result_text: "",
        }).catch(() => {});

        // Remove all state files for the previous CC session.
        await Promise.all([
          tryUnlink(`${STATE_DIR}/${current.cc_session_id}.json`),
          tryUnlink(`${STATE_DIR}/${current.cc_session_id}.started`),
          tryUnlink(`${STATE_DIR}/${current.cc_session_id}.turns`),
          tryUnlink(turnStartFile(current.cc_session_id)),
          tryUnlink(CURRENT_SESSION_FILE),
        ]).catch(() => {});
      }
    }

    // Open the new session straight away so the dashboard shows it immediately.
    // The placeholder prompt is replaced by the user's first real message via user_prompt.
    const newSessionId = agentviewSessionId ?? await getOrCreateSessionId(ccSessionId);
    await ensureSessionStarted(ccSessionId, newSessionId, `Claude Code session ${ccSessionId}`, msg.cwd);

    process.exit(0);
  }

  default:
    process.exit(0);
}

export {};
