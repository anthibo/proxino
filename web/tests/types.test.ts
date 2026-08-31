import { describe, it, expect } from "vitest";
import type { FlowMeta } from "../src/types";

describe("types", () => {
  it("FlowMeta shape compiles and reads fields", () => {
    const f: FlowMeta = {
      id: "a", timestamp: 1, client: { ip: "1.1.1.1", label: "x" },
      method: "GET", scheme: "https", host: "h", port: 443, path: "/p",
      query: "", http_version: "HTTP/2",
      request: { headers: [], size: 0 },
      response: { status: 200, reason: "OK", headers: [], size: 3, content_type: "application/json" },
      duration_ms: 142, state: "complete", error: null,
    };
    expect(f.response?.status).toBe(200);
  });
});
