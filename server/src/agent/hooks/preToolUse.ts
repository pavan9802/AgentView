import type { HookCallbackMatcher, PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";
import type { LoopState } from "../handlers/turnUsage";

export function makePreToolUseHook(loopState: LoopState): HookCallbackMatcher {
  return {
    hooks: [
      async (input) => {
        const msg = input as PreToolUseHookInput;
        loopState.toolTimestamps.set(msg.tool_use_id, Date.now());
        return { continue: true };
      },
    ],
  };
}
