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

describe("view switching + empty state", () => {
  beforeEach(() => useStore.getState().clear());

  it("shows the first-run empty state when there are no flows", () => {
    render(<App />);
    expect(screen.getByText(/Waiting for traffic/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect a device/i })).toBeInTheDocument();
  });

  it("switches to Devices and shows a per-device card from real flows", () => {
    useStore.getState().upsertFlow(mk("1"));
    useStore.getState().upsertFlow(mk("2", { response: { status: 500, reason: "", headers: [], size: 10, content_type: "" } }));
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "Devices" }));
    expect(screen.getByText("iPhone")).toBeInTheDocument();
    expect(screen.getByText("REQUESTS")).toBeInTheDocument();
    expect(screen.getByText("50.0%")).toBeInTheDocument();   // 1 of 2 errored
  });

  it("switches to Dashboard and shows totals", () => {
    useStore.getState().upsertFlow(mk("1"));
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "Dashboard" }));
    expect(screen.getByText("Traffic Dashboard")).toBeInTheDocument();
    expect(screen.getByText("TOTAL REQUESTS")).toBeInTheDocument();
  });
});
