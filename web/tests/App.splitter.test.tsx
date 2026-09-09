import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

describe("detail pane splitter", () => {
  beforeEach(() => {
    useStore.getState().clear();
    useStore.getState().setDetailWidth(420);
  });

  it("dragging the splitter by +100px resizes the detail pane from 420 to 520", () => {
    useStore.getState().upsertFlow(mk("1"));
    render(<App />);
    const splitter = screen.getByRole("separator");
    fireEvent.mouseDown(splitter, { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: -100 }); // dragging left grows the (right-hand) detail pane
    fireEvent.mouseUp(window);
    expect(useStore.getState().detailWidth).toBe(520);
  });
});
