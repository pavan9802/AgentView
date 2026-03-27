import type { ApiError } from "@agentview/shared";

export async function apiPost<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as ApiError;
    throw new Error(err.error ?? res.statusText);
  }

  return res.json() as Promise<TRes>;
}

export async function apiGet<TRes>(path: string): Promise<TRes> {
  const res = await fetch(path);

  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as ApiError;
    throw new Error(err.error ?? res.statusText);
  }

  return res.json() as Promise<TRes>;
}
