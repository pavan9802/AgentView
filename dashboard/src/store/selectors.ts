import type { Session, Turn, ToolCall } from "../lib/types";
import type { PendingApproval } from "@agentview/shared";
import type { FeedItem, TokenPoint, LatencyPoint } from "../lib/types";
import { BUDGET, CTX_MAX } from "../lib/constants";
import type { AgentViewState } from "./index";

export const selectSelectedSession = (state: AgentViewState): Session | undefined =>
  state.activeId != null ? state.sessions[state.activeId] : undefined;

export const selectAllSessions = (state: AgentViewState): Session[] =>
  Object.values(state.sessions).sort((a, b) => b.created_at - a.created_at);

export const selectTotalCost = (state: AgentViewState): number =>
  Object.values(state.sessions).reduce((sum, s) => sum + s.total_cost_usd, 0);

export const selectBudgetPct = (state: AgentViewState): number =>
  Math.min((selectTotalCost(state) / BUDGET) * 100, 100);

export const selectRunningCount = (state: AgentViewState): number =>
  Object.values(state.sessions).filter((s) => s.status === "running").length;

export const selectCtxPct =
  (sessionId: string) =>
  (state: AgentViewState): number => {
    const session = state.sessions[sessionId];
    if (!session) return 0;
    return Math.min((session.total_tokens / CTX_MAX) * 100, 100);
  };

export const selectTurnsForSession =
  (sessionId: string) =>
  (state: AgentViewState): Turn[] =>
    state.turns[sessionId] ?? [];

export const selectToolCallsForSession =
  (sessionId: string) =>
  (state: AgentViewState): ToolCall[] =>
    state.toolCalls[sessionId] ?? [];

export const selectFeedItems =
  (sessionId: string) =>
  (state: AgentViewState): FeedItem[] => {
    const turns = state.turns[sessionId] ?? [];
    const toolCalls = state.toolCalls[sessionId] ?? [];

    const turnItems: FeedItem[] = turns.map((t) => ({
      id: t.id,
      type: "turn" as const,
      turn: t.turn_number,
      ts: t.created_at,
    }));

    const toolItems: FeedItem[] = toolCalls.map((tc) => ({
      id: tc.id,
      type: "tool" as const,
      tool: tc.tool_name,
      arg: tc.tool_input,
      ts: tc.created_at,
      duration: tc.duration_ms,
    }));

    return [...turnItems, ...toolItems].sort((a, b) => a.ts - b.ts);
  };

export const selectTokenPoints =
  (sessionId: string) =>
  (state: AgentViewState): TokenPoint[] => {
    const turns = state.turns[sessionId] ?? [];
    return turns.map((t) => ({
      turn: t.turn_number,
      tokens: t.input_tokens + t.output_tokens,
    }));
  };

export const selectLatencyPoints =
  (sessionId: string) =>
  (state: AgentViewState): LatencyPoint[] => {
    const turns = state.turns[sessionId] ?? [];
    return turns.map((t) => ({
      turn: t.turn_number,
      latency: t.latency_ms,
      tokens: t.input_tokens + t.output_tokens,
    }));
  };

export const selectToolUsage =
  (sessionId: string) =>
  (state: AgentViewState): { tool: string; count: number }[] => {
    const toolCalls = state.toolCalls[sessionId] ?? [];
    const counts: Record<string, number> = {};
    for (const tc of toolCalls) {
      counts[tc.tool_name] = (counts[tc.tool_name] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count);
  };

export const selectPendingForSession =
  (sessionId: string) =>
  (state: AgentViewState): PendingApproval[] =>
    state.pendingApprovals[sessionId] ?? [];
