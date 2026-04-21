#!/usr/bin/env bun
/**
 * simulate-clear.ts
 *
 * Simulates the /clear scenario end-to-end:
 *   1. Creates a fake "previous" session in ~/.agentview/ and registers it on the
 *      server so the dashboard shows it as "running".
 *   2. Runs the hook's UserPromptSubmit path with a brand-new cc_session_id
 *      (exactly what happens when the user types their first message after /clear).
 *   3. Checks whether the old session was completed and the new session started.
 *
 * Usage:
 *   bun run simulate-clear.ts
 */

import { spawn } from "bun";

const AGENTVIEW_URL = process.env["AGENTVIEW_URL"] ?? "http://localhost:3000";
const INGEST = `${AGENTVIEW_URL}/ingest`;
const STATE_DIR = `${process.env["HOME"] ?? "/tmp"}/.agentview`;
const CURRENT_SESSION_FILE = `${STATE_DIR}/current_session.json`;

const OLD_CC_ID  = "sim-old-cc-session";
const OLD_AV_ID  = `sim-old-av-${Date.now()}`;
const NEW_CC_ID  = "sim-new-cc-session";

async function post(body: unknown): Promise<unknown> {
  const res = await fetch(INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Step 1: set up the "old" session state ────────────────────────────────────

console.log("=== Step 1: plant a fake running session ===");

// Write the cc→av mapping file and the .started flag (as ensureSessionStarted would)
await Bun.write(`${STATE_DIR}/${OLD_CC_ID}.json`,    JSON.stringify({ agentview_session_id: OLD_AV_ID }));
await Bun.write(`${STATE_DIR}/${OLD_CC_ID}.started`, "1");
await Bun.write(CURRENT_SESSION_FILE,                JSON.stringify({ agentview_session_id: OLD_AV_ID, cc_session_id: OLD_CC_ID }));

// Register the session on the server so the dashboard shows it as "running"
await post({
  type: "session_started",
  session_id: OLD_AV_ID,
  prompt: "Simulated session — should go from running → complete after clear",
  cwd: process.cwd(),
  created_at: Date.now(),
  approval_required_tools: [],
});

console.log(`  old cc_session_id : ${OLD_CC_ID}`);
console.log(`  old av_session_id : ${OLD_AV_ID}`);
console.log(`  dashboard should show this session as RUNNING now`);
console.log();

// ── Step 2: pause so you can see it on the dashboard ─────────────────────────

console.log("=== Step 2: waiting 3 seconds — check the dashboard ===");
await Bun.sleep(3_000);

// ── Step 3: simulate the first prompt after /clear ───────────────────────────

console.log();
console.log("=== Step 3: firing UserPromptSubmit with new cc_session_id ===");
console.log(`  new cc_session_id : ${NEW_CC_ID}`);

const payload = JSON.stringify({
  session_id: NEW_CC_ID,
  prompt: "First message in the new session after /clear",
  cwd: process.cwd(),
});

const proc = spawn({
  cmd: ["bun", "run", import.meta.dir + "/src/index.ts", "UserPromptSubmit"],
  stdin: new TextEncoder().encode(payload),
  stdout: "pipe",
  stderr: "pipe",
});

const [stdout, stderr, exitCode] = await Promise.all([
  new Response(proc.stdout).text(),
  new Response(proc.stderr).text(),
  proc.exited,
]);

if (stdout) console.log("  hook stdout:", stdout.trim());
if (stderr) console.log("  hook stderr:", stderr.trim());
console.log(`  hook exit code: ${exitCode}`);
console.log();

// ── Step 4: verify the resulting state ───────────────────────────────────────

console.log("=== Step 4: verifying state ===");

const oldMappingExists  = await Bun.file(`${STATE_DIR}/${OLD_CC_ID}.json`).exists();
const oldStartedExists  = await Bun.file(`${STATE_DIR}/${OLD_CC_ID}.started`).exists();
const newStartedExists  = await Bun.file(`${STATE_DIR}/${NEW_CC_ID}.started`).exists();
const currentRaw        = await Bun.file(CURRENT_SESSION_FILE).text().catch(() => "(missing)");

const pass = !oldMappingExists && !oldStartedExists && newStartedExists && currentRaw.includes(NEW_CC_ID);

console.log(`  old .json deleted        : ${!oldMappingExists  ? "✓" : "✗ STILL EXISTS"}`);
console.log(`  old .started deleted     : ${!oldStartedExists  ? "✓" : "✗ STILL EXISTS"}`);
console.log(`  new .started created     : ${newStartedExists   ? "✓" : "✗ MISSING"}`);
console.log(`  current_session.json     : ${currentRaw}`);
console.log(`  points to new cc_id      : ${currentRaw.includes(NEW_CC_ID) ? "✓" : "✗ WRONG"}`);
console.log();
console.log(pass ? "PASS — old session should be COMPLETE on dashboard, new session RUNNING" : "FAIL — something went wrong");

// ── Cleanup: remove sim files so they don't pollute real state ────────────────

const newMappingFile = `${STATE_DIR}/${NEW_CC_ID}.json`;
const newStartedFile = `${STATE_DIR}/${NEW_CC_ID}.started`;

for (const f of [
  `${STATE_DIR}/${OLD_CC_ID}.json`,
  `${STATE_DIR}/${OLD_CC_ID}.started`,
  newMappingFile,
  newStartedFile,
]) {
  if (await Bun.file(f).exists()) await Bun.file(f).unlink();
}

// Restore the real current_session.json so the live Claude session still works
const realSession = JSON.parse(
  await Bun.file(`${STATE_DIR}/5a50ad39-bf2b-404a-bd9d-f765daa355b6.json`).text().catch(() => "null"),
);
if (realSession) {
  await Bun.write(CURRENT_SESSION_FILE, JSON.stringify({
    agentview_session_id: realSession.agentview_session_id,
    cc_session_id: "5a50ad39-bf2b-404a-bd9d-f765daa355b6",
  }));
  console.log(`\nRestored current_session.json to real session (${realSession.agentview_session_id})`);
} else {
  console.log("\nCould not restore current_session.json — real session file not found");
}
