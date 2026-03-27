import type { KeyStatus } from "./session";

export type SyncStatus = {
  pending_rows: number;
  last_sync_at: number | null;
  is_reachable: boolean;
};

export type Config = {
  schema_version: number;
  device_id: string;
  encryption_key: string; // hex-encoded 32-byte random key
  encrypted_session_token: string | null;
  session_token_expires_at: number | null;
  key_status: KeyStatus;
  last_sync_at: number | null;
  port: number;
  budget_usd: number;
  max_turns: number;
};
