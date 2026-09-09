import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App";
import { useStore } from "../src/store";
import type { FlowMeta } from "../src/types";

const mk = (id: string, o: Partial<FlowMeta> = {}): FlowMeta => ({
  id, timestamp: Date.now(), client: { ip: "1.1.1.1", label: "iPhone", kind: "phone" }, method: "GET",
  scheme: "https", host: "api.soum.sa", port: 443, path: "/v2/" + id, query: "", http_version: "HTTP/2",
  request: { headers: [], size: 50 },
  response: { status: 200, reason: "OK", headers: [], size: 300, content_type: "application/json" },
  duration_ms: 120, state: "complete", error: null, ...o,
});

function setInnerWidth(w: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: w });
}

describe("detail pane re-clamps on window resize", () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    useStore.getState().clear();
  });

  afterEach(() => {
    setInnerWidth(originalInnerWidth);
  });

  it("shrinks detailWidth to fit after the window narrows", () => {
    setInnerWidth(2000);
    useStore.getState().setDetailWidth(1200); // 60% of 2000 -> stays 1200
    expect(useStore.getState().detailWidth).toBe(1200);

    useStore.getState().upsertFlow(mk("1"));
    render(<App />);

    setInnerWidth(1000);
    fireEvent(window, new Event("resize"));

    expect(useStore.getState().detailWidth).toBeLessThanOrEqual(600);
  });
});
