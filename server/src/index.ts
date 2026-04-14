import { handlePostSession, handlePostTurn } from "./routes/session";
import { handleWsOpen, handleWsMessage, handleWsClose } from "./ws/handler";
import { sessions } from "./state";
import { send } from "./ws/send";

if (!process.env["ANTHROPIC_API_KEY"]) {
  console.error("Error: ANTHROPIC_API_KEY is not set. Add it to .env and restart.");
  process.exit(1);
}

const PORT = Number(process.env["PORT"] ?? 3000);

const server = Bun.serve({
  port: PORT,

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 426 });
      }
      return undefined as unknown as Response;
    }

    if (req.method === "POST" && url.pathname === "/session") {
      return handlePostSession(req);
    }

    const turnMatch = url.pathname.match(/^\/session\/([^/]+)\/turn$/);
    if (req.method === "POST" && turnMatch?.[1]) {
      return handlePostTurn(req, turnMatch[1]);
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },

  websocket: {
    open: handleWsOpen,
    message: handleWsMessage,
    close: handleWsClose,
  },
});

console.log(`AgentView server — http://localhost:${server.port}`);

function shutdown() {
  for (const session of sessions.values()) {
    if (session.status === "running") {
      session.status = "killed";
      send({ type: "session_killed", session_id: session.id, reason: "server_shutdown" });
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
