export type { Session, Turn, ToolCall, SessionStatus, KeyStatus } from "@agentview/shared";
export type { SyncStatus } from "@agentview/shared";
export type { PendingApproval } from "@agentview/shared";

export type TurnFeedItem = {
  id: string;
  type: "turn";
  turn: number;
  ts: number;
  input_tokens: number;
  cost_usd: number;
};

export type ToolFeedItem = {
  id: string;
  type: "tool";
  tool: string;
  arg: string;
  ts: number;
  duration: number;
};

export type FeedItem = TurnFeedItem | ToolFeedItem;

export type TokenPoint = { turn: number; tokens: number };
export type LatencyPoint = { turn: number; latency: number; tokens: number };
