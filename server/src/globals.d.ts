// Activates bun-types when the package is installed (`bun install` / `npm install`).
// The reference is silently ignored if the package is not yet present.
/// <reference types="bun-types" />

// Minimal stubs for Bun globals used before bun-types is installed.
// Once bun-types resolves, these declarations merge harmlessly with the full types.

declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
  cwd(): string;
  on(event: string, listener: (...args: unknown[]) => void): void;
};

interface BunServerWebSocket {
  send(data: string | ArrayBuffer | Uint8Array): void;
  close(code?: number, reason?: string): void;
  readonly readyState: number;
}

declare const Bun: {
  serve(options: {
    port: number | string;
    fetch(req: Request): Response | Promise<Response> | undefined;
    websocket?: {
      open?(ws: BunServerWebSocket): void;
      message?(ws: BunServerWebSocket, data: string | Uint8Array): void;
      close?(ws: BunServerWebSocket, code?: number, reason?: string): void;
    };
  }): { port: number; upgrade(req: Request): boolean };
};
