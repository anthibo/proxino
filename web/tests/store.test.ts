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
});
