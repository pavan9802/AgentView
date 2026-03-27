import { useState, useCallback } from "react";
import type { StartSessionResponse } from "@agentview/shared";
import { sessionsApi } from "../api/sessions";

export type UseSessionsReturn = {
  startSession: (prompt: string) => Promise<StartSessionResponse>;
  isStarting: boolean;
  startError: string | null;
};

export function useSessions(): UseSessionsReturn {
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const startSession = useCallback(async (prompt: string): Promise<StartSessionResponse> => {
    setIsStarting(true);
    setStartError(null);
    try {
      return await sessionsApi.start(prompt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start session";
      setStartError(msg);
      throw err;
    } finally {
      setIsStarting(false);
    }
  }, []);

  return { startSession, isStarting, startError };
}
