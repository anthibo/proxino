import { describe, it, expect } from "vitest";
import { toCurl } from "../src/curl";
import type { FlowDetail } from "../src/types";

const d: FlowDetail = {
  id: "a", timestamp: 1, client: { ip: "1.1.1.1", label: "x" },
  method: "POST", scheme: "https", host: "api.soum.sa", port: 443,
  path: "/v2/checkout", query: "", http_version: "HTTP/2",
  request: { headers: [["content-type","application/json"],["x-tok","a'b"]], size: 5, body: '{"a":1}' },
  response: { status: 200, reason: "OK", headers: [], size: 0, content_type: "application/json", body: null },
  duration_ms: 1, state: "complete", error: null,
  timing: { start: 0, req_done: null, resp_start: null, resp_done: null, duration_ms: null, connect_ms: null, tls_ms: null, ttfb_ms: null, download_ms: null },
};

describe("toCurl", () => {
  it("includes method, url, headers, body", () => {
    const s = toCurl(d);
    expect(s).toContain("curl -X POST 'https://api.soum.sa/v2/checkout'");
    expect(s).toContain("-H 'content-type: application/json'");
    expect(s).toContain(`--data-raw '{"a":1}'`);
  });
  it("escapes single quotes in header values", () => {
    expect(toCurl(d)).toContain(`-H 'x-tok: a'\\''b'`);
  });
  it("omits body for bodyless requests", () => {
    const g = { ...d, method: "GET", request: { ...d.request, body: null } };
    expect(toCurl(g)).not.toContain("--data-raw");
  });
});
