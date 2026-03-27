import type { StartSessionRequest, StartSessionResponse } from "@agentview/shared";
import { apiPost } from "./client";

export const sessionsApi = {
  start: (prompt: string): Promise<StartSessionResponse> =>
    apiPost<StartSessionRequest, StartSessionResponse>("/session", { prompt }),
};
