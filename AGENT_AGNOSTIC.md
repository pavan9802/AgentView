# Agent-Agnostic Dashboard — Architecture & Data Flow

This document explains how the agent-agnostic layer works: what was added, why each piece exists, and exactly how data moves from an external agent into the dashboard.

---

## Background: what existed before

Before this change the server owned everything. It called `query()` from the Claude Agent SDK internally, hooked into SDK lifecycle events, and pushed WebSocket messages to the dashboard. The agent and the server were the same process.

```
┌─────────────────────────────────┐
│           Server process        │
│                                 │
│  POST /session ──► runAgent()   │
│                       │         │
│                   SDK hooks     │
│                       │         │
│                   ws/send.ts ──►│──► Dashboard /ws
└─────────────────────────────────┘
```

To support external agents the server needed to accept telemetry from the outside world and relay it to the dashboard — without changing a single line of dashboard code.

---

## What was added

Three new integration surfaces, one shared event processor:

| Surface | Protocol | Best for |
|---|---|---|
| `GET /agent-ws` | WebSocket (persistent) | SDK reporter — long-running agent process |
| `POST /ingest` | HTTP (one request per event) | Claude Code hook — new process per event |
| `@agentview/reporter` | Library wrapping `/agent-ws` | Any agent using the Claude Agent SDK |
| `agentview-hook` CLI | Calls `POST /ingest` | Claude Code hooks |

All four paths converge at `server/src/agent/ingest.ts → processAgentEvent()` which updates server state and calls `send()` to push to the dashboard.

---

## High-level data flow

```
┌──────────────────────┐        ┌─────────────────────────────────────────┐
│   External agent     │        │                 Server                  │
│                      │        │                                         │
│  @agentview/reporter │──WS──► │ /agent-ws ──► agentHandler.ts          │
│  (SDK users)         │◄──WS── │              ◄── approval_response      │
│                      │        │                        │                │
│  agentview-hook CLI  │─HTTP──►│ POST /ingest ──► routes/ingest.ts      │
│  (Claude Code users) │◄─HTTP──│              ◄── { approved }           │
│                      │        │                        │                │
└──────────────────────┘        │              processAgentEvent()        │
                                │                        │                │
                                │                   ws/send.ts            │
                                │                        │                │
                                └────────────────────────┼────────────────┘
                                                         │
                                                         ▼
                                               ┌──────────────────┐
                                               │    Dashboard     │
                                               │    /ws (React)   │
                                               └──────────────────┘
```

---

## Data flow 1 — SDK reporter (`@agentview/reporter`)

This path uses a single persistent WebSocket for the entire agent session.

```
Developer code                 reporter/src/index.ts          Server
──────────────────────────────────────────────────────────────────────────

createReporter({               opens WebSocket to /agent-ws
  serverUrl, prompt, cwd })    ──────────────────────────────► agentHandler.ts
                               sends session_started           processAgentEvent()
                               ──────────────────────────────►   sessions.set(id, {...})
                                                                  send({ type:"session_started" })
                                                                       │
                                                                       ▼
                                                                  Dashboard /ws

for await (msg of query({
  hooks: reporter.hooks,
  canUseTool: reporter.canUseTool
})) {
  reporter.handleMessage(msg)  // msg has usage data
}                              sends turn_update
                               ──────────────────────────────► processAgentEvent()
                                                                  sessions.get(id).total_cost += ...
                                                                  send({ type:"turn_update" })

// SDK fires PreToolUse hook    records timestamp in toolTimestamps map

// SDK fires canUseTool          (if tool needs approval)
                               sends approval_required
                               ──────────────────────────────► processAgentEvent()
                                                                  pendingApprovals.set(id, callback)
                                                                  send({ type:"approval_required" })
                                                                       │
                                                                       ▼
                                                                  Dashboard /ws
                                                                  (user sees approve/reject UI)

                               ◄─────────────────────────────── Dashboard sends approval_response
                                                                  handler.ts calls pendingApprovals callback
                                                                  callback sends approval_response back
                               ◄── { type:"approval_response" }   to reporter WS
                               reporter.pendingApprovals.get(id)
                               resolves the promise

// SDK fires PostToolUse hook   sends tool_call + tool_result
                               ──────────────────────────────► processAgentEvent()
                                                                  send({ type:"tool_call" })
                                                                  send({ type:"tool_result" })

await reporter.complete()      sends session_complete
                               ──────────────────────────────► processAgentEvent()
                                                                  sessions.get(id).status = "complete"
                                                                  agentConnections.delete(id)
                                                                  send({ type:"session_complete" })
reporter.close()               closes WebSocket
```

---

## Data flow 2 — Claude Code hook (`agentview-hook`)

Each hook event spawns a new process. Persistence across events is handled by files in `~/.agentview/`.

```
Claude Code                    agentview-hook process             Server
──────────────────────────────────────────────────────────────────────────

fires PreToolUse event         new process starts
stdin: {                       reads stdin JSON
  session_id: "cc-abc",        getOrCreateSessionId("cc-abc")
  tool_name: "Bash",             reads ~/.agentview/cc-abc.json
  tool_input: {...}              (or creates it with a new UUID)
}                              agentview_session_id = "av-xyz"

                               ensureSessionStarted()
                                 checks ~/.agentview/cc-abc.started
                                 (file absent → first hook for this session)
                               POST /ingest { type:"session_started",
                                              session_id:"av-xyz", ... }
                               ──────────────────────────────► handlePostIngest()
                                                                  processAgentEvent()
                                                                    sessions.set("av-xyz", {...})
                                                                    send({ type:"session_started" })
                                 writes ~/.agentview/cc-abc.started  │
                                                                      ▼
                                                                  Dashboard /ws

                               (tool needs approval — Bash is in approvalTools)
                               POST /ingest { type:"approval_required",
                                              session_id:"av-xyz",
                                              tool_call_id:"uuid", ... }
                               ──────────────────────────────► handlePostIngest()
                                                                  processAgentEvent()
                                                                    pendingApprovals.set("uuid", resolve)
                                                                    send({ type:"approval_required" })
                               ◄── HTTP request hangs here ──        │
                                                                      ▼
                                                                  Dashboard /ws
                                                                  (user clicks Approve)
                                                                  Dashboard sends approval_response
                                                               ◄── handler.ts calls pendingApprovals["uuid"](true)
                                                                    resolve(true) ← the HTTP promise resolves
                               ◄── HTTP responds { approved:true }

                               approved = true → process.exit(0)
Claude Code allows the tool

──────────────────────────────────────────────────────────────────────────

fires PostToolUse event        new process starts
stdin: {                       reads stdin
  session_id: "cc-abc",        getOrCreateSessionId → "av-xyz" (reads file)
  tool_name: "Bash",           ensureSessionStarted → already started (flag file exists)
  tool_response: "output..."   POST /ingest { type:"tool_call", ... }
}                              ──────────────────────────────► handlePostIngest()
                                                                  send({ type:"tool_call" })
                               POST /ingest { type:"tool_result", ... }
                               ──────────────────────────────► handlePostIngest()
                                                                  send({ type:"tool_result" })
                               process.exit(0)

──────────────────────────────────────────────────────────────────────────

fires Stop event               new process starts
stdin: {                       POST /ingest { type:"session_complete", ... }
  session_id: "cc-abc",        ──────────────────────────────► handlePostIngest()
  stop_hook_active: false          processAgentEvent()
}                                    sessions.get("av-xyz").status = "complete"
                                     send({ type:"session_complete" })
                               deletes ~/.agentview/cc-abc.json
                               deletes ~/.agentview/cc-abc.started
                               process.exit(0)
```

---

## Data flow 3 — approval from dashboard (shared by all paths)

This is the most important sub-flow because it crosses three files.

```
Dashboard (React)          server/ws/handler.ts        server/agent/ingest.ts
─────────────────────────────────────────────────────────────────────────────

User clicks Approve
WS send: {
  type: "approval_response",
  tool_call_id: "uuid",
  approved: true
}
                      handleWsMessage() receives it
                      case "approval_response":
                        const resolve =
                          pendingApprovals.get("uuid")
                        pendingApprovals.delete("uuid")
                        resolve(true)  ◄─────────────── this is the callback stored by
                                                        processAgentEvent() when it handled
                                                        the original approval_required event

── what the callback does depends on which path stored it ──────────────────

  SDK reporter path:           HTTP ingest path:
  callback = (approved) => {   callback = resolve  ← the Promise resolver
    agentWs.send({               await promise in handlePostIngest()
      type:"approval_response",  resolves, HTTP response sent: { approved:true }
      tool_call_id:"uuid",       agentview-hook process receives response
      approved                   process.exit(0) or process.exit(2)
    });
    internalResolve(approved);
  }
  reporter WS receives message
  pendingApprovals["uuid"] resolves
  canUseTool() returns { behavior:"allow" }
  SDK continues
```

---

## Data flow 4 — kill from dashboard

```
Dashboard                  server/ws/handler.ts        External agent
────────────────────────────────────────────────────────────────────

User clicks Kill
WS send: { type:"kill_session", session_id:"av-xyz" }

                      handleWsMessage() receives it
                      case "kill_session":
                        agentWs = agentConnections.get("av-xyz")

                        if agentWs exists:                              (SDK reporter path)
                          agentWs.send({ type:"kill" })  ─────────────► reporter receives "kill"
                          agentConnections.delete("av-xyz")              (caller's AbortController
                                                                          handles stopping query())
                        else:                                           (internal SDK path)
                          session.abortController.abort()

                      session.status = "killed"
                      drain pendingApprovals (unblock any waiting approval)
                      send({ type:"session_killed" }) ──────────────────► Dashboard /ws updated
```

---

## File-by-file reference

### `shared/src/ingest.ts` *(new)*

Defines the message contract between external agents and the server. Two directions:

**`AgentToServer`** — what agents send to the server:

| Message type | When sent | Key fields |
|---|---|---|
| `session_started` | Agent begins a new session | `session_id`, `prompt`, `cwd`, `approval_required_tools` |
| `turn_update` | After each model response | `turn` (tokens, cost, latency), cumulative totals |
| `tool_call` | After a tool finishes | Full `ToolCall` record with `duration_ms` |
| `tool_result` | After a tool finishes | Raw output text or JSON |
| `approval_required` | Before a sensitive tool runs | `tool_call_id`, `tool_name`, `tool_input` |
| `session_complete` | Agent finishes normally | Final totals, `result_text` |
| `session_errored` | Agent throws | `error_type`, `error_message` |
| `session_killed` | Agent was stopped | `reason` |

**`ServerToAgent`** — what the server sends back (WebSocket path only):

| Message type | When sent | Key fields |
|---|---|---|
| `approval_response` | Dashboard approves/rejects a tool | `tool_call_id`, `approved` |
| `kill` | Dashboard kills the session | `session_id` |

---

### `shared/src/index.ts` *(modified)*

Re-exports all types from `ingest.ts` alongside existing types. This keeps `@agentview/shared` as the single import point for every package in the monorepo.

---

### `server/src/globals.d.ts` *(modified)*

Adds two things to the type stubs for the Bun runtime:

```ts
// 1. Every WebSocket now carries a role tag
interface BunServerWebSocket {
  readonly data: { role: "dashboard" | "agent" };
}

// 2. upgrade() accepts the tag at connection time
upgrade(req: Request, options?: { data: { role: ... } }): boolean
```

Without these additions, `ws.data.role` and `server.upgrade(req, { data: ... })` would be TypeScript errors.

---

### `server/src/state.ts` *(modified)*

One new Map:

```ts
export const agentConnections = new Map<string, BunServerWebSocket>();
// session_id → the agent's WebSocket connection
```

Used for two things:
- Sending `approval_response` back to SDK reporter agents
- Forwarding `kill` commands from the dashboard to external agents
- Detecting unexpected disconnections in `agentHandler.ts`

---

### `server/src/agent/ingest.ts` *(new)*

The single event processor shared by both the WebSocket and HTTP paths. Signature:

```ts
function processAgentEvent(
  msg: AgentToServer,
  agentWs?: BunServerWebSocket,   // present for WS path, absent for HTTP
): Promise<boolean> | null        // only non-null for approval_required
```

**Why one function for both paths?**
The event handling logic — update in-memory state, forward to dashboard — is identical regardless of whether the event arrived via WebSocket or HTTP. Keeping it in one place means a bug fix or feature applies to both automatically.

**The approval split:**

```ts
// WS path: callback pushes message back to agent socket
pendingApprovals.set(id, (approved) => {
  agentWs.send(JSON.stringify({ type: "approval_response", approved }));
  resolve(approved);
});

// HTTP path: callback IS the promise resolver
pendingApprovals.set(id, resolve);
```

The existing `pendingApprovals` map in `state.ts` stores `(approved: boolean) => void` callbacks. The dashboard's `handler.ts` calls these callbacks when `approval_response` arrives — it doesn't need to know whether it's talking to an SDK reporter, Claude Code hook, or internal SDK session. The callback's behaviour is baked in at registration time.

---

### `server/src/ws/agentHandler.ts` *(new)*

Thin WebSocket lifecycle handlers for `/agent-ws` connections:

- **`open`** — does nothing; the session ID isn't known until `session_started` arrives.
- **`message`** — parses JSON, calls `processAgentEvent(msg, ws)`.
- **`close`** — scans `agentConnections` to find which session this socket belonged to. If that session is still running, marks it `errored` and notifies the dashboard.

---

### `server/src/routes/ingest.ts` *(new)*

HTTP handler for `POST /ingest`. Two behaviours:

**`approval_required`** — synchronous (long-poll):
```ts
const approvalPromise = processAgentEvent(msg);  // stores callback, notifies dashboard
const approved = await approvalPromise;           // hangs until dashboard responds
return Response.json({ approved });               // hook process unblocks
```

**Everything else** — fire-and-forget:
```ts
processAgentEvent(msg);                           // update state, notify dashboard
return Response.json({ ok: true });               // immediate response
```

---

### `server/src/ws/handler.ts` *(modified)*

One block changed — `kill_session`:

```ts
const agentWs = agentConnections.get(msg.session_id);
if (agentWs) {
  // External agent: forward kill over its own socket
  agentWs.send(JSON.stringify({ type: "kill" }));
  agentConnections.delete(msg.session_id);
} else {
  // Internal (SDK) session: abort the in-process runner
  session.abortController.abort();
}
```

The `approval_response` case is unchanged — the callback stored in `pendingApprovals` handles routing transparently.

---

### `server/src/index.ts` *(modified)*

Two additions to routing:

```ts
// New WebSocket endpoint for agents
if (url.pathname === "/agent-ws") {
  server.upgrade(req, { data: { role: "agent" } });
}

// New HTTP endpoint for fire-and-forget events
if (req.method === "POST" && url.pathname === "/ingest") {
  return handlePostIngest(req);
}
```

And the WebSocket dispatcher uses the `role` tag to route:

```ts
websocket: {
  open(ws)    { ws.data.role === "agent" ? handleAgentWsOpen(ws)    : handleWsOpen(ws) },
  message(ws) { ws.data.role === "agent" ? handleAgentWsMessage(ws) : handleWsMessage(ws) },
  close(ws)   { ws.data.role === "agent" ? handleAgentWsClose(ws)   : handleWsClose(ws) },
}
```

Bun uses a single `websocket` object for all WebSocket connections regardless of which URL they came from, so the role tag is the only way to distinguish them at runtime.

---

### `reporter/src/index.ts` *(new)*

A library that wraps the Claude Agent SDK's hook system and forwards events to `/agent-ws`.

**Public API:**

```ts
const reporter = createReporter({ serverUrl, prompt, cwd, approvalRequiredTools });

for await (const msg of query({ prompt, options: {
  hooks: reporter.hooks,
  canUseTool: reporter.canUseTool,
}})) {
  reporter.handleMessage(msg);  // tracks turns, sends turn_update
}
await reporter.complete();      // sends session_complete
reporter.close();               // closes WebSocket
```

**Internal state:**
- `ws` — the WebSocket connection to `/agent-ws`
- `ready` — a Promise that resolves when the socket is open; all sends await it
- `pendingApprovals` — mirrors the server's map; stores resolvers for approval promises
- `toolTimestamps` — `tool_use_id → Date.now()` set in PreToolUse, read in PostToolUse for duration
- `loop` — turn tracking state (turnId, turnNumber, cumulative cost/tokens, resultText)

**`canUseTool` — how approval suspension works:**

```ts
// 1. Send approval request to server
send({ type: "approval_required", tool_call_id: toolUseID, ... });

// 2. Register a resolver in pendingApprovals and suspend
const approved = await new Promise<boolean>((resolve) => {
  pendingApprovals.set(toolUseID, resolve);
});
// ↑ execution pauses here — the for-await loop is blocked

// 3. Server receives approval_required, notifies dashboard
// 4. User clicks Approve
// 5. Dashboard sends approval_response over /ws
// 6. handler.ts calls pendingApprovals callback → sends approval_response to reporter WS
// 7. ws.onmessage fires → pendingApprovals.get(toolUseID)(true) → promise resolves
// ↓ execution resumes

return approved ? { behavior: "allow" } : { behavior: "deny", message: "User rejected" };
```

**`handleMessage` — turn tracking:**

The `query()` generator yields raw API response objects. Some of them contain a `usage` field with token counts. `handleMessage` checks for this, computes cost and context fill percentage using the configurable pricing rates, builds a `Turn` record, updates cumulative totals, and sends `turn_update` to the server.

---

### `claude-code-hook/src/index.ts` *(new)*

A CLI that bridges Claude Code's hook system to `POST /ingest`. Claude Code fires each hook as a new process with event data on stdin.

**Session ID persistence problem and solution:**

Claude Code gives each session a `session_id`. The hook fires as a fresh process with no memory of previous invocations. To group all hooks from one Claude Code session under one dashboard entry, two files are written to `~/.agentview/`:

| File | Content | Purpose |
|---|---|---|
| `~/.agentview/<cc-id>.json` | `{ agentview_session_id: "uuid" }` | Maps CC session ID to AgentView session ID |
| `~/.agentview/<cc-id>.started` | `"1"` | Flag: `session_started` already sent |

Both files are deleted when the `Stop` hook fires.

**Hook behaviour by type:**

**`PreToolUse`:**
1. Read session mapping from file (or create it)
2. If `session_started` not yet sent, POST it now
3. If tool is not in `AGENTVIEW_APPROVAL_TOOLS`, `process.exit(0)` immediately
4. POST `approval_required` — this call **blocks** until the dashboard responds
5. If `approved: false` → print block JSON to stdout, `process.exit(2)` (Claude Code sees this as "tool blocked")
6. If `approved: true` → `process.exit(0)` (Claude Code allows the tool)

**`PostToolUse`:**
1. Read session mapping
2. POST `tool_call` and `tool_result` (fire-and-forget with `.catch(() => {})`)
3. `process.exit(0)`

**`Stop`:**
1. If `stop_hook_active: true` → skip (would cause a loop)
2. POST `session_complete`
3. Delete both `~/.agentview/` files
4. `process.exit(0)`

**Exit code semantics (Claude Code contract):**
- `0` — hook ran successfully, Claude Code proceeds normally
- `2` — PreToolUse hook is blocking the tool; stdout is shown to the model as the reason
- `1` — unexpected error (not used explicitly, but any non-zero non-2 exit is treated as an error)

---

## Key design decisions

**Why a shared `processAgentEvent()` instead of duplicating logic?**
Both the WebSocket and HTTP paths need identical behaviour for six of the eight event types. Keeping it in one function means the dashboard always gets the same events regardless of how the agent is connected, and there's one place to add new event types in the future.

**Why does `pendingApprovals` work across all three approval paths (internal SDK, reporter WS, Claude Code HTTP)?**
The map stores `(approved: boolean) => void` callbacks. The *behaviour* of each callback differs by path, but `handler.ts` just calls `resolve(approved)` — it doesn't care what the callback does. This is a form of dependency inversion: the approval routing logic lives at registration time (in `processAgentEvent`), not at resolution time (in `handler.ts`).

**Why use HTTP for Claude Code hook instead of WebSocket?**
Each Claude Code hook invocation is a new process. Maintaining a WebSocket connection across process boundaries would require storing the connection state externally (e.g. a local proxy process). HTTP is stateless by nature — one request per event is simpler and more reliable for this use case. The one exception (approval) works because the HTTP request can block for an arbitrary duration while waiting for the dashboard response.

**Why temp files for session tracking in the Claude Code hook?**
Claude Code runs each hook as a separate process, so there is no shared memory. Temp files in `~/.agentview/` are the simplest form of IPC between hook invocations. An alternative would be a local daemon process, but that adds complexity without much benefit for a dashboard integration.

**Why does the dashboard code not change at all?**
The dashboard consumes `WsServerToClient` messages over `/ws`. That contract is unchanged. `processAgentEvent()` translates `AgentToServer` messages into `WsServerToClient` messages before forwarding them. The dashboard is completely isolated from the agent integration layer.
