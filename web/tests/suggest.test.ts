import { describe, it, expect } from "vitest";
import { suggest } from "../src/filters/suggest";

describe("suggest", () => {
  it("completes field names by prefix", () => {
    const tokens = suggest("host:x sta").map((s) => s.token);
    expect(tokens).toContain("status:");
    expect(tokens).not.toContain("method:");
  });
  it("suggests method values", () => {
    const tokens = suggest("method:").map((s) => s.token);
    expect(tokens).toEqual(expect.arrayContaining(["method:GET", "method:POST"]));
  });
  it("filters method values by partial", () => {
    expect(suggest("method:P").map((s) => s.token)).toEqual(["method:POST", "method:PUT", "method:PATCH"]);
  });
  it("suggests PATCH", () => {
    expect(suggest("method:PAT").map((s) => s.token)).toContain("method:PATCH");
  });
  it("empty query returns field completions", () => {
    expect(suggest("").length).toBeGreaterThan(0);
  });
});
