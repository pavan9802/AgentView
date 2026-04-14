import type { Session, Turn, ToolCall, KeyStatus } from "./session";
import type { SyncStatus } from "./config";

// ── POST /session ─────────────────────────────────────────────────────────────
export type StartSessionRequest = { prompt: string };
export type StartSessionResponse = { id: string; status: "created" };

// ── POST /session/:id/turn ────────────────────────────────────────────────────
export type AddTurnRequest = { prompt: string };
export type AddTurnResponse = { ok: true };

// ── DELETE /session/:id ───────────────────────────────────────────────────────
export type KillSessionResponse = { ok: true };

// ── GET /sessions ─────────────────────────────────────────────────────────────
export type ListSessionsResponse = { sessions: Session[] };

// ── GET /session/:id ──────────────────────────────────────────────────────────
export type GetSessionResponse = {
  session: Session;
  turns: Turn[];
  tool_calls: ToolCall[];
};

// ── POST /auth/request-otp ────────────────────────────────────────────────────
export type RequestOtpRequest = { email: string };
export type RequestOtpResponse = { ok: true; expires_at: number };

// ── POST /auth/verify-otp ─────────────────────────────────────────────────────
export type VerifyOtpRequest = { email: string; otp: string };
export type VerifyOtpResponse = { token: string; expires_at: number };

// ── POST /api-key ─────────────────────────────────────────────────────────────
export type SetApiKeyRequest = { api_key: string };
export type SetApiKeyResponse = { status: KeyStatus };

// ── GET /sync/status ──────────────────────────────────────────────────────────
export type GetSyncStatusResponse = SyncStatus;

// ── Shared error shape (all endpoints) ───────────────────────────────────────
export type ApiError = { error: string; code: string };
