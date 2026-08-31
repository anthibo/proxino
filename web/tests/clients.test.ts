import { describe, it, expect } from "vitest";
import { deriveClients } from "../src/clients";
import type { FlowMeta } from "../src/types";
import type { DeviceKind } from "../src/types";
const mk = (ip: string, label: string, kind: DeviceKind = "unknown"): FlowMeta => ({
  id: Math.random()+"", timestamp: 1, client: { ip, label, kind }, method: "GET",
  scheme: "https", host: "h", port: 443, path: "/", query: "", http_version: "HTTP/2",
  request: { headers: [], size: 0 }, response: null, duration_ms: null, state: "pending", error: null,
});
describe("deriveClients", () => {
  it("counts per ip, most-active first, label from flows", () => {
    const list = deriveClients([mk("1.1.1.1","iPhone"), mk("1.1.1.1","iPhone"), mk("2.2.2.2","Mac")], {});
    expect(list[0]).toEqual({ ip: "1.1.1.1", label: "iPhone", count: 2, kind: "unknown" });
    expect(list[1]).toEqual({ ip: "2.2.2.2", label: "Mac", count: 1, kind: "unknown" });
  });
  it("override label wins", () => {
    const list = deriveClients([mk("1.1.1.1","iPhone")], { "1.1.1.1": "My Phone" });
    expect(list[0].label).toBe("My Phone");
  });
  it("carries device kind, filling it in from a later flow", () => {
    const list = deriveClients([mk("1.1.1.1","iPhone"), mk("1.1.1.1","iPhone","phone")], {});
    expect(list[0].kind).toBe("phone");
  });
});
