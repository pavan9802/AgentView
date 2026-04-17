import type { WsClientToServer, WsServerToClient } from "@agentview/shared";
import { handleMessage } from "./handlers";
import { useAgentView } from "../store";

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

let ws: WebSocket | null = null;
let reconnectDelay = RECONNECT_BASE_MS;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function openSocket(): void {
  useAgentView.getState().setWsStatus("connecting");
  ws = new WebSocket("ws://localhost:3000/ws");

  ws.onopen = () => {
    reconnectDelay = RECONNECT_BASE_MS;
    clearReconnectTimer();
    useAgentView.getState().setWsStatus("connected");
  };

  ws.onmessage = (event: MessageEvent) => {
    let msg: WsServerToClient;
    try {
      msg = JSON.parse(event.data as string) as WsServerToClient;
    } catch (err) {
      console.error("[ws] failed to parse message", err);
      return;
    }
    handleMessage(msg);
  };

  ws.onclose = () => {
    useAgentView.getState().setWsStatus("disconnected");
    ws = null;
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
      openSocket();
    }, reconnectDelay);
  };
}

export function connect(): void {
  if (started) return;
  started = true;
  openSocket();
}

export const wsClient = {
  send(msg: WsClientToServer): void {
    if (ws !== null && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  },
};
