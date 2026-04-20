import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

export class PromptQueue implements AsyncIterable<SDKUserMessage> {
  private queue: SDKUserMessage[] = [];
  private notify: (() => void) | null = null;
  private closed = false;

  push(msg: SDKUserMessage): void {
    if (this.closed) {
      console.warn("[PromptQueue] push() called after close() — message dropped");
      return;
    }
    this.queue.push(msg);
    this.notify?.();
    this.notify = null;
  }

  close(): void {
    this.closed = true;
    this.notify?.();
    this.notify = null;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift()!;
      } else if (this.closed) {
        return;
      } else {
        await new Promise<void>((r) => { this.notify = r; });
      }
    }
  }
}
