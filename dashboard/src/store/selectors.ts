import type { Session, Turn, ToolCall } from "../lib/types";
import type { PendingApproval } from "@agentview/shared";
import type { FeedItem, TokenPoint, LatencyPoint } from "../lib/types";
import { BUDGET } from "../lib/constants";
import { formatToolInput } from "../lib/formatToolInput";
import type { AgentViewState } from "./index";

// Stable empty fallbacks so `?? []` never allocates a new array on each call
const EMPTY_TURNS: Turn[] = [];
const EMPTY_TOOL_CALLS: ToolCall[] = [];
const EMPTY_APPROVALS: PendingApproval[] = [];

// ── Scalar / direct-reference selectors (always stable) ───────────────────────

export const selectSelectedSession = (state: AgentViewState): Session | undefined =>
  state.activeId != null ? state.sessions[state.activeId] : undefined;

export const selectIsClaudeCodeSession = (id: string) => (state: AgentViewState): boolean =>
  state.sessions[id]?.source === "claude_code";

export const selectTotalCost = (state: AgentViewState): number =>
  Object.values(state.sessions).reduce((sum, s) => sum + s.total_cost_usd, 0);

export const selectBudgetPct = (state: AgentViewState): number =>
  Math.min((selectTotalCost(state) / BUDGET) * 100, 100);

export const selectRunningCount = (state: AgentViewState): number =>
  Object.values(state.sessions).filter((s) => s.status === "running").length;

export const selectCtxPct =
  (sessionId: string) =>
  (state: AgentViewState): number => {
    const turns = state.turns[sessionId];
    if (!turns || turns.length === 0) return 0;
    return turns.at(-1)!.context_fill_pct;
  };

export const selectTurnsForSession =
  (sessionId: string) =>
  (state: AgentViewState): Turn[] =>
    state.turns[sessionId] ?? EMPTY_TURNS;

export const selectToolCallsForSession =
  (sessionId: string) =>
  (state: AgentViewState): ToolCall[] =>
    state.toolCalls[sessionId] ?? EMPTY_TOOL_CALLS;

export const selectPendingForSession =
  (sessionId: string) =>
  (state: AgentViewState): PendingApproval[] =>
    state.pendingApprovals[sessionId] ?? EMPTY_APPROVALS;

// ── Derived selectors — memoized by input reference ───────────────────────────
// Each of these creates new objects when mapping/reducing. Without memoization,
// they return a new array reference on every call, which makes useSyncExternalStore
// think the state changed on every render, causing an infinite loop.
//
// The fix: cache the last result per sessionId keyed by the input array reference.
// The store replaces the array reference only when real data changes (upsertIntoArray
// always returns a new array), so an identity check is sufficient.

export const selectAllSessions: (state: AgentViewState) => Session[] = (() => {
  let lastSessions: Record<string, Session> | undefined;
  let lastResult: Session[] = [];
  return (state: AgentViewState): Session[] => {
    if (state.sessions === lastSessions) return lastResult;
    lastSessions = state.sessions;
    lastResult = Object.values(state.sessions).sort((a, b) => b.created_at - a.created_at);
    return lastResult;
  };
})();

export const selectFeedItems = (() => {
  const cache = new Map<string, { turns: Turn[]; toolCalls: ToolCall[]; result: FeedItem[] }>();
  return (sessionId: string) => (state: AgentViewState): FeedItem[] => {
    const turns = state.turns[sessionId] ?? EMPTY_TURNS;
    const toolCalls = state.toolCalls[sessionId] ?? EMPTY_TOOL_CALLS;
    const cached = cache.get(sessionId);
    if (cached && cached.turns === turns && cached.toolCalls === toolCalls) return cached.result;
    const turnItems: FeedItem[] = turns.map((t) => ({
      id: t.id,
      type: "turn" as const,
      turn: t.turn_number,
      ts: t.created_at,
      input_tokens: t.input_tokens,
      cost_usd: t.cost_usd,
    }));
    const toolItems: FeedItem[] = toolCalls.map((tc) => ({
      id: tc.id,
      type: "tool" as const,
      tool: tc.tool_name,
      arg: formatToolInput(tc.tool_name, tc.tool_input),
      ts: tc.created_at,
      duration: tc.duration_ms,
    }));
    const result = [...turnItems, ...toolItems].sort((a, b) => a.ts - b.ts);
    cache.set(sessionId, { turns, toolCalls, result });
    return result;
  };
})();

export const selectTokenPoints = (() => {
  const cache = new Map<string, { turns: Turn[]; result: TokenPoint[] }>();
  return (sessionId: string) => (state: AgentViewState): TokenPoint[] => {
    const turns = state.turns[sessionId] ?? EMPTY_TURNS;
    const cached = cache.get(sessionId);
    if (cached && cached.turns === turns) return cached.result;
    const result = turns.map((t) => ({
      turn: t.turn_number,
      tokens: t.input_tokens + t.output_tokens,
    }));
    cache.set(sessionId, { turns, result });
    return result;
  };
})();

export const selectLatencyPoints = (() => {
  const cache = new Map<string, { turns: Turn[]; result: LatencyPoint[] }>();
  return (sessionId: string) => (state: AgentViewState): LatencyPoint[] => {
    const turns = state.turns[sessionId] ?? EMPTY_TURNS;
    const cached = cache.get(sessionId);
    if (cached && cached.turns === turns) return cached.result;
    const result = turns.map((t) => ({
      turn: t.turn_number,
      latency: t.latency_ms,
      tokens: t.input_tokens + t.output_tokens,
    }));
    cache.set(sessionId, { turns, result });
    return result;
  };
})();

export const selectToolUsage = (() => {
  const cache = new Map<string, { toolCalls: ToolCall[]; result: { tool: string; count: number }[] }>();
  return (sessionId: string) => (state: AgentViewState): { tool: string; count: number }[] => {
    const toolCalls = state.toolCalls[sessionId] ?? EMPTY_TOOL_CALLS;
    const cached = cache.get(sessionId);
    if (cached && cached.toolCalls === toolCalls) return cached.result;
    const counts: Record<string, number> = {};
    for (const tc of toolCalls) {
      counts[tc.tool_name] = (counts[tc.tool_name] ?? 0) + 1;
    }
    const result = Object.entries(counts)
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count);
    cache.set(sessionId, { toolCalls, result });
    return result;
  };
})();
