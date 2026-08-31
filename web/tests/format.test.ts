import { describe, it, expect } from "vitest";
import { bytes, typeLabel, clockTime } from "../src/format";

describe("bytes", () => {
  it("formats B / KB / MB and dashes empties", () => {
    expect(bytes(0)).toBe("—");
    expect(bytes(null)).toBe("—");
    expect(bytes(512)).toBe("512 B");
    expect(bytes(4096)).toBe("4.0 KB");
    expect(bytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

describe("typeLabel", () => {
  it("maps content-types to short labels", () => {
    expect(typeLabel("application/json; charset=utf-8")).toBe("json");
    expect(typeLabel("text/html")).toBe("html");
    expect(typeLabel("image/webp")).toBe("webp");
    expect(typeLabel("application/javascript")).toBe("js");
    expect(typeLabel(undefined)).toBe("—");
  });
});

describe("clockTime", () => {
  it("renders HH:MM:SS.mmm and dashes null", () => {
    expect(clockTime(null)).toBe("—");
    expect(clockTime(0)).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });
});
