import { randomFrom, randomInt } from "./utils";
import { TOOLS, FILES } from "./constants";
import type { FeedItem, Session, ToolFeedItem, TurnFeedItem } from "./types";

export function makeToolCall(): ToolFeedItem {
  const tool = randomFrom(TOOLS) ?? "Read";
  const arg =
    tool === "Bash"
      ? (randomFrom(["npm run test", "npm run lint", "npm run build", "git status"]) ?? "npm run test")
      : tool === "WebSearch"
        ? "JWT token expiry best practices"
        : (randomFrom(FILES) ?? "index.ts");
  return {
    id: Math.random().toString(36).slice(2),
    type: "tool",
    tool,
    arg,
    ts: Date.now(),
    duration: randomInt(40, 800),
  };
}

export function makeTurnMarker(turn: number): TurnFeedItem {
  return { id: Math.random().toString(36).slice(2), type: "turn", turn, ts: Date.now(), input_tokens: 0, cost_usd: 0 };
}

export const SEED_SESSIONS: Session[] = [
  {
    id: "s1",
    name: "Fix auth module",
    status: "running" as const,
    status2: "executing",
    feed: [
      { id: "a0", type: "turn", turn: 1, ts: Date.now() - 180000, input_tokens: 0, cost_usd: 0 },
      { id: "a1", type: "tool", tool: "Glob",  arg: "**/*.ts",               ts: Date.now() - 175000, duration: 180 },
      { id: "a2", type: "tool", tool: "Read",  arg: "src/auth/index.ts",     ts: Date.now() - 165000, duration: 95  },
      { id: "a3", type: "tool", tool: "Read",  arg: "src/middleware/jwt.ts", ts: Date.now() - 155000, duration: 88  },
      { id: "a4", type: "turn", turn: 2, ts: Date.now() - 140000, input_tokens: 0, cost_usd: 0 },
      { id: "a5", type: "tool", tool: "Grep",  arg: "verifyToken",           ts: Date.now() - 135000, duration: 42  },
      { id: "a6", type: "tool", tool: "Read",  arg: "src/utils/crypto.ts",   ts: Date.now() - 125000, duration: 77  },
      { id: "a7", type: "turn", turn: 3, ts: Date.now() - 110000, input_tokens: 0, cost_usd: 0 },
      { id: "a8", type: "tool", tool: "Write", arg: "src/auth/index.ts",     ts: Date.now() - 100000, duration: 130 },
      { id: "a9", type: "turn", turn: 4, ts: Date.now() - 80000, input_tokens: 0, cost_usd: 0 },
      { id: "aa", type: "tool", tool: "Bash",  arg: "npm run test",          ts: Date.now() - 70000,  duration: 3200 },
      { id: "ab", type: "turn", turn: 5, ts: Date.now() - 40000, input_tokens: 0, cost_usd: 0 },
      { id: "ac", type: "tool", tool: "Read",  arg: "tests/auth.test.ts",    ts: Date.now() - 30000,  duration: 90  },
      { id: "ad", type: "tool", tool: "Write", arg: "src/auth/index.ts",     ts: Date.now() - 15000,  duration: 110 },
    ] satisfies FeedItem[],
    turn: 6, cost: 0.048, tokens: 14200,
    tokenHistory: [
      { turn: 1, tokens: 2100 }, { turn: 2, tokens: 4800 }, { turn: 3, tokens: 7200 },
      { turn: 4, tokens: 9800 }, { turn: 5, tokens: 11400 }, { turn: 6, tokens: 14200 },
    ],
    turnLatency: [
      { turn: 1, latency: 1200, tokens: 2100 }, { turn: 2, latency: 2800, tokens: 4800 },
      { turn: 3, latency: 1900, tokens: 7200 }, { turn: 4, latency: 3400, tokens: 9800 },
      { turn: 5, latency: 2100, tokens: 11400 }, { turn: 6, latency: 2900, tokens: 14200 },
    ],
    startedAt: Date.now() - 600000, unread: 0, pendingApproval: null,
  },
  {
    id: "s2",
    name: "Refactor API routes",
    status: "complete" as const,
    status2: "complete",
    feed: [
      { id: "b0", type: "turn", turn: 1, ts: Date.now() - 5400000, input_tokens: 0, cost_usd: 0 },
      { id: "b1", type: "tool", tool: "Glob",  arg: "src/api/**/*.ts",  ts: Date.now() - 5390000, duration: 210 },
      { id: "b2", type: "tool", tool: "Read",  arg: "src/api/routes.ts", ts: Date.now() - 5380000, duration: 105 },
      { id: "b3", type: "turn", turn: 2, ts: Date.now() - 5360000, input_tokens: 0, cost_usd: 0 },
      { id: "b4", type: "tool", tool: "Write", arg: "src/api/routes.ts", ts: Date.now() - 5350000, duration: 145 },
      { id: "b5", type: "tool", tool: "Bash",  arg: "npm run build",     ts: Date.now() - 5330000, duration: 4100 },
      { id: "b6", type: "turn", turn: 3, ts: Date.now() - 5300000, input_tokens: 0, cost_usd: 0 },
      { id: "b7", type: "tool", tool: "Bash",  arg: "npm run test",      ts: Date.now() - 5280000, duration: 3800 },
    ] satisfies FeedItem[],
    turn: 18, cost: 0.12, tokens: 38400,
    tokenHistory: Array.from({ length: 18 }, (_, i) => ({ turn: i + 1, tokens: Math.floor(2000 * Math.pow(1.18, i)) })),
    turnLatency: Array.from({ length: 18 }, (_, i) => ({
      turn: i + 1,
      latency: randomInt(900, 3800),
      tokens: Math.floor(2000 * Math.pow(1.18, i)),
    })),
    startedAt: Date.now() - 7200000, unread: 0, pendingApproval: null,
  },
  {
    id: "s3",
    name: "Write unit tests",
    status: "complete" as const,
    status2: "complete",
    feed: [
      { id: "c0", type: "turn", turn: 1, ts: Date.now() - 9000000, input_tokens: 0, cost_usd: 0 },
      { id: "c1", type: "tool", tool: "Read",  arg: "src/auth/index.ts",  ts: Date.now() - 8990000, duration: 88  },
      { id: "c2", type: "turn", turn: 2, ts: Date.now() - 8970000, input_tokens: 0, cost_usd: 0 },
      { id: "c3", type: "tool", tool: "Write", arg: "tests/auth.test.ts", ts: Date.now() - 8960000, duration: 200 },
      { id: "c4", type: "tool", tool: "Bash",  arg: "npm run test",       ts: Date.now() - 8940000, duration: 2900 },
    ] satisfies FeedItem[],
    turn: 5, cost: 0.031, tokens: 9800,
    tokenHistory: Array.from({ length: 5 }, (_, i) => ({ turn: i + 1, tokens: randomInt(1800, 3200) * (i + 1) })),
    turnLatency: Array.from({ length: 5 }, (_, i) => ({
      turn: i + 1,
      latency: randomInt(900, 2800),
      tokens: randomInt(1800, 3200) * (i + 1),
    })),
    startedAt: Date.now() - 10800000, unread: 0, pendingApproval: null,
  },
];
