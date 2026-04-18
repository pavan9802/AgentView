#!/usr/bin/env bun
/**
 * agentview-hook — Claude Code hook bridge for AgentView dashboard.
 *
 * Usage in .claude/settings.json:
 *
 *   {
 *     "hooks": {
 *       "PreToolUse":  [{ "command": "agentview-hook PreToolUse"  }],
 *       "PostToolUse": [{ "command": "agentview-hook PostToolUse" }],
 *       "Stop":        [{ "command": "agentview-hook Stop"        }]
 *     }
 *   }
 *
 * Environment variables:
 *   AGENTVIEW_URL  — AgentView server base URL (default: http://localhost:3000)
 *
 * Exit codes:
 *   0  — hook handled successfully (tool is allowed for PreToolUse)
 *   2  — tool rejected by dashboard (PreToolUse approval denied)
 *   1  — unexpected error
 */

const AGENTVIEW_URL = process.env["AGENTVIEW_URL"] ?? "http://localhost:3000";
const INGEST = `${AGENTVIEW_URL}/ingest`;

// ── Claude Code hook input shapes ─────────────────────────────────────────

type PreToolUseInput = {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
};

type PostToolUseInput = {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: unknown;
};

type StopInput = {
  session_id: string;
  stop_hook_active: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function post(body: unknown): Promise<unknown> {
  const res = await fetch(INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// ── Session tracking via a local temp file ─────────────────────────────────
// Each Claude Code session_id gets a stable AgentView session_id so the
// dashboard groups all hooks from one CC session under one entry.

const STATE_DIR = `${process.env["HOME"] ?? "/tmp"}/.agentview`;

async function getOrCreateSessionId(ccSessionId: string): Promise<string> {
  await Bun.write(`${STATE_DIR}/.keep`, "");
  const stateFile = `${STATE_DIR}/${ccSessionId}.json`;
  const f = Bun.file(stateFile);
  if (await f.exists()) {
    const data = (await f.json()) as { agentview_session_id: string };
    return data.agentview_session_id;
  }
  const id = crypto.randomUUID();
  await Bun.write(stateFile, JSON.stringify({ agentview_session_id: id }));
  return id;
}

async function ensureSessionStarted(
  ccSessionId: string,
  agentviewSessionId: string,
  prompt: string,
  cwd: string,
): Promise<void> {
  const flagFile = `${STATE_DIR}/${ccSessionId}.started`;
  if (await Bun.file(flagFile).exists()) return;

  await post({
    type: "session_started",
    session_id: agentviewSessionId,
    prompt,
    cwd,
    created_at: Date.now(),
    approval_required_tools: (process.env["AGENTVIEW_APPROVAL_TOOLS"] ?? "Bash,Write").split(",").map((s) => s.trim()),
  });

  await Bun.write(flagFile, "1");
}

// ── Main ───────────────────────────────────────────────────────────────────

const hookType = process.argv[2];
if (!hookType) {
  console.error("agentview-hook: missing hook type argument (PreToolUse | PostToolUse | Stop)");
  process.exit(1);
}

const raw = await readStdin();
if (!raw.trim()) process.exit(0);

let input: unknown;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}

const ccSessionId = (input as { session_id?: string }).session_id ?? "unknown";
const cwd = (input as { cwd?: string }).cwd ?? process.cwd();

const agentviewSessionId = await getOrCreateSessionId(ccSessionId);

switch (hookType) {
  case "PreToolUse": {
    const msg = input as PreToolUseInput;

    // Derive a stable tool_use_id from session + tool + timestamp.
    const toolUseId = crypto.randomUUID();

    await ensureSessionStarted(ccSessionId, agentviewSessionId, `Claude Code session ${ccSessionId}`, cwd);

    const approvalTools = (process.env["AGENTVIEW_APPROVAL_TOOLS"] ?? "Bash,Write")
      .split(",")
      .map((s) => s.trim());

    if (!approvalTools.includes(msg.tool_name)) {
      process.exit(0);
    }

    // Long-poll: POST blocks until dashboard approves or rejects.
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
      // If the server is unreachable, allow the tool (fail open).
      approved = true;
    }

    if (!approved) {
      // Exit code 2 tells Claude Code to block the tool.
      // Anything written to stdout is shown to the model as the reason.
      console.log(JSON.stringify({ decision: "block", reason: "Rejected by AgentView dashboard" }));
      process.exit(2);
    }

    process.exit(0);
    break;
  }

  case "PostToolUse": {
    const msg = input as PostToolUseInput;
    const toolUseId = crypto.randomUUID();

    await ensureSessionStarted(ccSessionId, agentviewSessionId, `Claude Code session ${ccSessionId}`, cwd);

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
        duration_ms: 0,
        approved: null,
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
    break;
  }

  case "Stop": {
    const msg = input as StopInput;
    if (msg.stop_hook_active) {
      process.exit(0);
    }

    await post({
      type: "session_complete",
      session_id: agentviewSessionId,
      total_cost_usd: 0,
      total_tokens: 0,
      total_turns: 0,
      result_text: "",
    }).catch(() => {});

    // Clean up state files.
    const stateFile = `${STATE_DIR}/${ccSessionId}.json`;
    const flagFile = `${STATE_DIR}/${ccSessionId}.started`;
    await Promise.all([
      Bun.file(stateFile).exists().then((e) => e && Bun.file(stateFile).unlink?.()),
      Bun.file(flagFile).exists().then((e) => e && Bun.file(flagFile).unlink?.()),
    ]).catch(() => {});

    process.exit(0);
    break;
  }

  default:
    process.exit(0);
}
