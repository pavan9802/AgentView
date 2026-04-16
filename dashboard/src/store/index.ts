import { create } from "zustand";
import type { Session, Turn, ToolCall, KeyStatus } from "../lib/types";
import type { PendingApproval, SyncStatus, WsInitMessage } from "@agentview/shared";
import { wsClient } from "../ws/client";

// ── State ─────────────────────────────────────────────────────────────────────

type State = {
  sessions: Record<string, Session>;
  turns: Record<string, Turn[]>;            // keyed by session_id, sorted by created_at asc
  toolCalls: Record<string, ToolCall[]>;    // keyed by session_id, sorted by created_at asc
  pendingApprovals: Record<string, PendingApproval[]>; // keyed by session_id
  activeId: string | null;
  keyStatus: KeyStatus;
  syncStatus: SyncStatus | null;
  wsConnected: boolean;
};

// ── Actions ───────────────────────────────────────────────────────────────────

type Actions = {
  upsertSession: (session: Session) => void;
  upsertTurn: (turn: Turn) => void;
  upsertToolCall: (tc: ToolCall) => void;
  addPendingApproval: (approval: PendingApproval) => void;
  removePendingApproval: (sessionId: string, toolCallId: string) => void;
  clearPendingApprovalsForSession: (sessionId: string) => void;
  setActiveId: (id: string | null) => void;
  setKeyStatus: (status: KeyStatus) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setWsConnected: (connected: boolean) => void;
  initFromServer: (msg: WsInitMessage) => void;
  sendApprovalResponse: (sessionId: string, toolCallId: string, approved: boolean) => void;
  sendKill: (sessionId: string) => void;
};

export type AgentViewState = State & Actions;

// ── Helpers ───────────────────────────────────────────────────────────────────

function upsertIntoArray<T extends { id: string; created_at: number }>(
  existing: T[],
  item: T,
): T[] {
  const idx = existing.findIndex((x) => x.id === item.id);
  if (idx === -1) {
    const insertAt = existing.findIndex((x) => x.created_at > item.created_at);
    if (insertAt === -1) return [...existing, item];
    return [...existing.slice(0, insertAt), item, ...existing.slice(insertAt)];
  }
  const next = [...existing];
  next[idx] = item;
  return next;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAgentView = create<AgentViewState>((set, get) => ({
  sessions: {},
  turns: {},
  toolCalls: {},
  pendingApprovals: {},
  activeId: null,
  keyStatus: "unknown",
  syncStatus: null,
  wsConnected: false,

  upsertSession: (session) =>
    set((state) => ({
      sessions: { ...state.sessions, [session.id]: session },
    })),

  upsertTurn: (turn) =>
    set((state) => ({
      turns: {
        ...state.turns,
        [turn.session_id]: upsertIntoArray(state.turns[turn.session_id] ?? [], turn),
      },
    })),

  upsertToolCall: (tc) =>
    set((state) => ({
      toolCalls: {
        ...state.toolCalls,
        [tc.session_id]: upsertIntoArray(state.toolCalls[tc.session_id] ?? [], tc),
      },
    })),

  addPendingApproval: (approval) =>
    set((state) => ({
      pendingApprovals: {
        ...state.pendingApprovals,
        [approval.session_id]: [
          ...(state.pendingApprovals[approval.session_id] ?? []),
          approval,
        ],
      },
    })),

  removePendingApproval: (sessionId, toolCallId) =>
    set((state) => ({
      pendingApprovals: {
        ...state.pendingApprovals,
        [sessionId]: (state.pendingApprovals[sessionId] ?? []).filter(
          (a) => a.tool_call_id !== toolCallId,
        ),
      },
    })),

  clearPendingApprovalsForSession: (sessionId) =>
    set((state) => ({
      pendingApprovals: { ...state.pendingApprovals, [sessionId]: [] },
    })),

  setActiveId: (id) => set({ activeId: id }),

  setKeyStatus: (status) => set({ keyStatus: status }),

  setSyncStatus: (status) => set({ syncStatus: status }),

  setWsConnected: (connected) => set({ wsConnected: connected }),

  initFromServer: (msg) => {
    const turns: Record<string, Turn[]> = {};
    for (const turn of msg.turns) {
      (turns[turn.session_id] ??= []).push(turn);
    }
    for (const arr of Object.values(turns)) {
      arr.sort((a, b) => a.created_at - b.created_at);
    }

    const toolCalls: Record<string, ToolCall[]> = {};
    for (const tc of msg.tool_calls) {
      (toolCalls[tc.session_id] ??= []).push(tc);
    }
    for (const arr of Object.values(toolCalls)) {
      arr.sort((a, b) => a.created_at - b.created_at);
    }

    const sessions: Record<string, Session> = {};
    for (const s of msg.sessions) {
      sessions[s.id] = s;
    }

    const pendingApprovals = msg.pending_approvals.reduce<Record<string, PendingApproval[]>>(
      (acc, a) => { (acc[a.session_id] ??= []).push(a); return acc; },
      {},
    );

    // Reset activeId if the selected session is no longer in the snapshot
    const currentActiveId = get().activeId;
    const activeId = currentActiveId != null && sessions[currentActiveId] != null
      ? currentActiveId
      : null;

    set({ sessions, turns, toolCalls, pendingApprovals, keyStatus: msg.key_status, syncStatus: msg.sync_status, activeId });
  },

  sendApprovalResponse: (sessionId, toolCallId, approved) => {
    wsClient.send({ type: "approval_response", session_id: sessionId, tool_call_id: toolCallId, approved });
    get().removePendingApproval(sessionId, toolCallId);
  },

  sendKill: (sessionId) => {
    wsClient.send({ type: "kill_session", session_id: sessionId });
  },
}));
