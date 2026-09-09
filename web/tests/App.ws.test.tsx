import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { useStore } from "../src/store";
import type { FlowMeta, FlowDetail } from "../src/types";

let capturedOnEvent: ((e: unknown) => void) | undefined;
let capturedOnReconnect: (() => void) | undefined;

vi.mock("../src/ws", () => ({
  connectWS: (onEvent: (e: unknown) => void, onReconnect?: () => void) => {
    capturedOnEvent = onEvent;
    capturedOnReconnect = onReconnect;
    return () => {};
  },
}));

vi.mock("../src/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api")>();
  return {
    ...actual,
    fetchFlows: vi.fn().mockResolvedValue([]),
    fetchPassthrough: vi.fn().mockResolvedValue([]),
    fetchWsMessages: vi.fn().mockResolvedValue({ messages: [{ i: 0, t: 1, dir: "in", type: "text", size: 1, text: "x", view: null, pretty: null }], total: 1 }),
  };
});

import { fetchWsMessages } from "../src/api";
import { App } from "../src/App";

const mk = (id: string, o: Partial<FlowMeta> = {}): FlowMeta => ({
  id, timestamp: Date.now(), client: { ip: "1.1.1.1", label: "iPhone", kind: "phone" }, method: "GET",
  scheme: "https", host: "api.soum.sa", port: 443, path: "/v2/" + id, query: "", http_version: "HTTP/2",
  request: { headers: [], size: 50 },
  response: { status: 200, reason: "OK", headers: [], size: 300, content_type: "application/json" },
  duration_ms: 120, state: "complete", error: null, ...o,
});

const mkWsDetail = (id: string): FlowDetail => ({
  ...mk(id, { kind: "ws", response: null, ws: { messages: 2, open: true, closed_by: null, close_code: null, close_reason: null } }),
  request: { headers: [], size: 0, body: null },
  response: null,
  timing: { start: 1, req_done: 1, resp_start: null, resp_done: null, duration_ms: null, connect_ms: null, tls_ms: null, ttfb_ms: null, download_ms: null },
});

describe("App websocket wiring", () => {
  beforeEach(() => {
    useStore.getState().clear();
    vi.clearAllMocks();
    capturedOnEvent = undefined;
    capturedOnReconnect = undefined;
  });

  it("resync refetches frames for the selected ws flow on reconnect", async () => {
    useStore.getState().upsertFlow(mk("w1", { kind: "ws" }));
    useStore.getState().select("w1", mkWsDetail("w1"));
    render(<App />);
    await waitFor(() => expect(capturedOnReconnect).toBeTruthy());
    (fetchWsMessages as unknown as ReturnType<typeof vi.fn>).mockClear();
    capturedOnReconnect!();
    await waitFor(() => expect(fetchWsMessages).toHaveBeenCalledWith("w1"));
    await waitFor(() => expect(useStore.getState().wsMessages["w1"]?.length).toBe(1));
  });

  it("does not refetch frames on reconnect when the selected flow is plain http", async () => {
    useStore.getState().upsertFlow(mk("h1"));
    useStore.getState().select("h1", { ...mk("h1"), request: { headers: [], size: 0, body: null }, response: null, timing: { start: 1, req_done: 1, resp_start: null, resp_done: null, duration_ms: null, connect_ms: null, tls_ms: null, ttfb_ms: null, download_ms: null } } as FlowDetail);
    render(<App />);
    await waitFor(() => expect(capturedOnReconnect).toBeTruthy());
    (fetchWsMessages as unknown as ReturnType<typeof vi.fn>).mockClear();
    capturedOnReconnect!();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchWsMessages).not.toHaveBeenCalled();
  });

  it("appends a ws.message only when it belongs to the selected flow", async () => {
    useStore.getState().upsertFlow(mk("w1", { kind: "ws" }));
    useStore.getState().upsertFlow(mk("w2", { kind: "ws" }));
    useStore.getState().select("w1", mkWsDetail("w1"));
    render(<App />);
    await waitFor(() => expect(capturedOnEvent).toBeTruthy());
    const msg = { i: 5, t: 1, dir: "in" as const, type: "text" as const, size: 1, text: "hi", view: null, pretty: null };
    capturedOnEvent!({ type: "ws.message", flow_id: "w2", message: msg });
    expect(useStore.getState().wsMessages["w2"]).toBeUndefined();
    capturedOnEvent!({ type: "ws.message", flow_id: "w1", message: msg });
    expect(useStore.getState().wsMessages["w1"]?.map((m) => m.i)).toContain(5);
  });

  it("refetches frames on reconnect when flow is upgraded to ws after selection", async () => {
    const httpFlow = mk("f1");
    useStore.getState().upsertFlow(httpFlow);
    const httpDetail = { ...httpFlow, request: { headers: [], size: 0, body: null }, response: null, timing: { start: 1, req_done: 1, resp_start: null, resp_done: null, duration_ms: null, connect_ms: null, tls_ms: null, ttfb_ms: null, download_ms: null } } as FlowDetail;
    useStore.getState().select("f1", httpDetail);
    render(<App />);
    await waitFor(() => expect(capturedOnReconnect).toBeTruthy());
    (fetchWsMessages as unknown as ReturnType<typeof vi.fn>).mockClear();
    useStore.getState().upsertFlow(mk("f1", { kind: "ws" }));
    capturedOnReconnect!();
    await waitFor(() => expect(fetchWsMessages).toHaveBeenCalledWith("f1"));
  });
});
