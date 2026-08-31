import type { WSEvent } from "./types";
export const connectWS = (
  onEvent: (e: WSEvent) => void,
  onReconnect?: () => void,
): (() => void) => {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${location.host}/ws`;
  const backoff = [1000, 2000, 5000];
  let attempt = 0;
  let closedByUser = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sock: WebSocket;
  const open = (isReconnect: boolean) => {
    sock = new WebSocket(url);
    sock.onopen = () => { attempt = 0; if (isReconnect) onReconnect?.(); };
    sock.onmessage = (m) => onEvent(JSON.parse(m.data));
    sock.onerror = () => console.warn("[proxino] websocket error");
    sock.onclose = () => {
      console.warn("[proxino] websocket closed");
      if (closedByUser) return;
      const delay = backoff[Math.min(attempt, backoff.length - 1)];
      attempt++;
      timer = setTimeout(() => open(true), delay);
    };
  };
  open(false);
  return () => { closedByUser = true; clearTimeout(timer); sock.close(); };
};
