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

export type FeedItem = TurnFeedItem | ToolFeedItem;

export type TokenPoint = { turn: number; tokens: number };
export type LatencyPoint = { turn: number; latency: number; tokens: number };

export type Session = {
  id: string;
  name: string;
  status: string;
  status2: string;
  feed: FeedItem[];
  turn: number;
  cost: number;
  tokens: number;
  tokenHistory: TokenPoint[];
  turnLatency: LatencyPoint[];
  startedAt: number;
  unread: number;
  pendingApproval: string | null;
};
