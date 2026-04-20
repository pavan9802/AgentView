import type { StartSessionRequest, StartSessionResponse, AddTurnRequest, AddTurnResponse } from "@agentview/shared";
import { apiPost } from "./client";

export const sessionsApi = {
  start: (prompt: string): Promise<StartSessionResponse> =>
    apiPost<StartSessionRequest, StartSessionResponse>("/session", { prompt }),

  addTurn: (sessionId: string, prompt: string): Promise<AddTurnResponse> =>
    apiPost<AddTurnRequest, AddTurnResponse>(`/session/${sessionId}/turn`, { prompt }),
};
