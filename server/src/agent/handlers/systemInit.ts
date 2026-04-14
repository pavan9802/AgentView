import type { SessionState } from "../../state";

export function handleSystemInit(
  message: unknown,
  session: SessionState,
  sessionId: string,
  isResume: boolean,
): void {
  if (
    typeof message !== "object" || message === null ||
    !("type" in message) || (message as { type: unknown }).type !== "system" ||
    !("subtype" in message) || (message as { subtype: unknown }).subtype !== "init" ||
    !("session_id" in message) || typeof (message as { session_id: unknown }).session_id !== "string"
  ) return;

  const { session_id } = message as { session_id: string };
  session.sdk_session_id = session_id;
  console.log(`[session:${sessionId}] ${isResume ? "confirmed" : "captured"} sdk_session_id: ${session_id}`);
}
