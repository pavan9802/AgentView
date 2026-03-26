// Activates bun-types when the package is installed (`bun install` / `npm install`).
// The reference is silently ignored if the package is not yet present.
/// <reference types="bun-types" />

// Minimal stubs for Bun globals used before bun-types is installed.
// Once bun-types resolves, these declarations merge harmlessly with the full types.

declare const process: {
  env: Record<string, string | undefined>;
};

declare const Bun: {
  serve(options: {
    port: number | string;
    fetch(req: Request): Response | Promise<Response>;
  }): { port: number };
};
