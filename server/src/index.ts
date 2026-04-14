import { handlePostSession, handlePostTurn } from "./routes/session";

if (!process.env["ANTHROPIC_API_KEY"]) {
  console.error("Error: ANTHROPIC_API_KEY is not set. Add it to .env and restart.");
  process.exit(1);
}

const PORT = Number(process.env["PORT"] ?? 3000);

const server = Bun.serve({
  port: PORT,

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

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
});

console.log(`AgentView server — http://localhost:${server.port}`);
