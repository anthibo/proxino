import { describe, it, expect } from "vitest";
import { classify, childCount, collapsedLabel } from "../src/json/summary";

describe("summary", () => {
  it("classifies types", () => {
    expect(classify("x")).toBe("string");
    expect(classify(1)).toBe("number");
    expect(classify(true)).toBe("boolean");
    expect(classify(null)).toBe("null");
    expect(classify([1])).toBe("array");
    expect(classify({ a: 1 })).toBe("object");
  });
  it("counts children", () => {
    expect(childCount({ a: 1, b: 2 })).toBe(2);
    expect(childCount([1, 2, 3])).toBe(3);
    expect(childCount(5)).toBe(0);
  });
  it("collapsed labels (singular/plural)", () => {
    expect(collapsedLabel({ a: 1, b: 2 })).toBe("{ … } 2 keys");
    expect(collapsedLabel({ a: 1 })).toBe("{ … } 1 key");
    expect(collapsedLabel([1, 2])).toBe("[ … ] 2 items");
    expect(collapsedLabel([1])).toBe("[ … ] 1 item");
  });
});
