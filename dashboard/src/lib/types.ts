export type { Session, Turn, ToolCall, SessionStatus, KeyStatus } from "@agentview/shared";
export type { SyncStatus } from "@agentview/shared";
export type { PendingApproval } from "@agentview/shared";

export type TurnFeedItem = {
  id: string;
  type: "turn";
  turn: number;
  ts: number;
};

export type ToolFeedItem = {
  id: string;
  type: "tool";
  tool: string;
  arg: string;
  ts: number;
  duration: number;
};

export type PromptFeedItem = {
  id: string;
  session_id: string;
  type: "prompt";
  prompt: string;
  ts: number;
};

export type AssistantFeedItem = {
  id: string;
  session_id: string;
  type: "assistant";
  text: string;
  ts: number;
};

export type FeedItem = TurnFeedItem | ToolFeedItem | PromptFeedItem | AssistantFeedItem;

export type TokenPoint = { turn: number; tokens: number };
export type LatencyPoint = { turn: number; latency: number; tokens: number };
