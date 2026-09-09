import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../src/store";
import type { FlowMeta } from "../src/types";

const mk = (id: string, o: Partial<FlowMeta> = {}): FlowMeta => ({
  id, timestamp: Number(id), client: { ip: "1.1.1.1", label: "x" },
  method: "GET", scheme: "https", host: "api.soum.sa", port: 443,
  path: "/v2/" + id, query: "", http_version: "HTTP/2",
  request: { headers: [], size: 0 },
  response: { status: 200, reason: "", headers: [], size: 0, content_type: "application/json" },
  duration_ms: 1, state: "complete", error: null, ...o,
});

describe("store", () => {
  beforeEach(() => useStore.getState().clear());
  it("upsert replaces by id and visible is newest-first", () => {
    useStore.getState().upsertFlow(mk("1"));
    useStore.getState().upsertFlow(mk("2"));
    useStore.getState().upsertFlow(mk("1", { state: "error" }));
    const v = useStore.getState().visibleFlows();
    expect(v.map((f) => f.id)).toEqual(["2", "1"]);
    expect(v.find((f) => f.id === "1")!.state).toBe("error");
  });
  it("query filters visible flows", () => {
    useStore.getState().upsertFlow(mk("1", { host: "api.soum.sa" }));
    useStore.getState().upsertFlow(mk("2", { host: "google.com" }));
    useStore.getState().setQuery("host:*.soum.sa");
    expect(useStore.getState().visibleFlows().map((f) => f.id)).toEqual(["1"]);
  });
  it("selectClient filters by ip", () => {
    useStore.getState().upsertFlow(mk("1", { client: { ip: "1.1.1.1", label: "a" } }));
    useStore.getState().upsertFlow(mk("2", { client: { ip: "2.2.2.2", label: "b" } }));
    useStore.getState().selectClient("2.2.2.2");
    expect(useStore.getState().visibleFlows().map((f) => f.id)).toEqual(["2"]);
  });
  it("setPassthrough replaces the passthrough host list", () => {
    expect(useStore.getState().passthrough).toEqual([]);
    const hosts = [{ host: "pinned.example.com", source: "auto" as const, active: true, failures: 2,
      clients: ["1.1.1.1"], first_seen: 1, last_seen: 2 }];
    useStore.getState().setPassthrough(hosts);
    expect(useStore.getState().passthrough).toEqual(hosts);
  });
});

describe("store.detailWidth", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("defaults to 420", () => {
    // fresh store instance state should default to 420 unless localStorage overrides
    expect(useStore.getState().detailWidth).toBeGreaterThanOrEqual(320);
  });
  it("clamps below 320 up to 320", () => {
    useStore.getState().setDetailWidth(100);
    expect(useStore.getState().detailWidth).toBe(320);
  });
  it("clamps above 60% of window.innerWidth", () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { value: 1000, configurable: true });
    useStore.getState().setDetailWidth(900);
    expect(useStore.getState().detailWidth).toBe(600);
    Object.defineProperty(window, "innerWidth", { value: originalInnerWidth, configurable: true });
  });
  it("persists to localStorage under proxino.detailWidth", () => {
    useStore.getState().setDetailWidth(500);
    expect(localStorage.getItem("proxino.detailWidth")).toBe("500");
  });
});

test("appendWsMessage caps at 500 and keeps order", () => {
  const s = useStore.getState();
  for (let i = 0; i < 505; i++) s.appendWsMessage("w", { i, t: i, dir: "out", type: "text", size: 1, text: "x", view: null, pretty: null });
  const msgs = useStore.getState().wsMessages["w"];
  expect(msgs.length).toBe(500); expect(msgs[0].i).toBe(5); expect(msgs[499].i).toBe(504);
});
test("setWsMessages replaces", () => {
  useStore.getState().setWsMessages("w", [{ i: 9, t: 0, dir: "in", type: "binary", size: 2, text: null, view: null, pretty: null }]);
  expect(useStore.getState().wsMessages["w"].map((m) => m.i)).toEqual([9]);
});
