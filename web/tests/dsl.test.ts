import { describe, it, expect } from "vitest";
import { parseQuery } from "../src/filters/dsl";
import type { FlowMeta } from "../src/types";

const f = (o: Partial<FlowMeta> = {}): FlowMeta => ({
  id: "a", timestamp: 0, client: { ip: "192.168.1.23", label: "iPhone" },
  method: "GET", scheme: "https", host: "api.soum.sa", port: 443,
  path: "/v2/listings", query: "", http_version: "HTTP/2",
  request: { headers: [], size: 0 },
  response: { status: 200, reason: "", headers: [], size: 0, content_type: "application/json" },
  duration_ms: 100, state: "complete", error: null, ...o,
});

describe("parseQuery", () => {
  it("empty matches all", () => expect(parseQuery("")(f())).toBe(true));
  it("status comparison", () => {
    const p = parseQuery("status:>=400");
    expect(p(f({ response: { ...f().response!, status: 500 } }))).toBe(true);
    expect(p(f())).toBe(false);
  });
  it("host wildcard", () => {
    const p = parseQuery("host:*.soum.sa");
    expect(p(f())).toBe(true);
    expect(p(f({ host: "google.com" }))).toBe(false);
  });
  it("method and path combine (AND)", () => {
    const p = parseQuery("method:GET path:/v2/*");
    expect(p(f())).toBe(true);
    expect(p(f({ method: "POST" }))).toBe(false);
  });
  it("bare term is free text over host/path/method", () => {
    expect(parseQuery("listings")(f())).toBe(true);
    expect(parseQuery("checkout")(f())).toBe(false);
  });
  it("type maps to content-type subtype", () => {
    expect(parseQuery("type:json")(f())).toBe(true);
    expect(parseQuery("type:webp")(f())).toBe(false);
  });
});
