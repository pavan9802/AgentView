import type { HookCallbackMatcher } from "@anthropic-ai/claude-agent-sdk";
import type { SessionState } from "../../state";
import type { LoopState } from "../handlers/turnUsage";
import { send } from "../../ws/send";

export function makeStopHook(
  session: SessionState,
  sessionId: string,
  loopState: LoopState,
): HookCallbackMatcher {
  return {
    hooks: [
      async (_input) => {
        // kill_reason is set when the session was aborted (budget, max-turns, user).
        // In those cases the catch block handles the terminal event — don't overwrite.
        if (session.kill_reason === null) {
          session.status = "complete";
          session.completed_at = Date.now();
          session.result_text = loopState.resultText;
          send({
            type: "session_complete",
            session_id: sessionId,
            total_cost_usd: session.total_cost_usd,
            total_turns: session.total_turns,
            result_text: loopState.resultText,
          });
          console.log(`[session:${sessionId}] complete — cost: $${session.total_cost_usd.toFixed(4)}, turns: ${session.total_turns}`);
        }
        return { continue: true };
      },
    ],
  };
}
