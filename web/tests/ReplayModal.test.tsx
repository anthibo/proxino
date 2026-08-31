import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReplayModal } from "../src/components/ReplayModal";
import type { FlowDetail } from "../src/types";

const replayEdited = vi.fn((_id: string, _edits: unknown) => Promise.resolve({ ok: true }));
vi.mock("../src/api", () => ({ replayEdited: (id: string, edits: unknown) => replayEdited(id, edits) }));

const detail: FlowDetail = {
  id: "a", timestamp: 1, client: { ip: "1.1.1.1", label: "x" }, method: "GET",
  scheme: "https", host: "api.soum.sa", port: 443, path: "/v2/x", query: "q=1", http_version: "HTTP/2",
  request: { headers: [["accept", "*/*"]], size: 0, body: null },
  response: null, duration_ms: null, state: "complete", error: null,
  timing: { start: 1, req_done: null, resp_start: null, resp_done: null, duration_ms: null, connect_ms: null, tls_ms: null, ttfb_ms: null, download_ms: null },
};

describe("ReplayModal", () => {
  beforeEach(() => replayEdited.mockClear());

  it("prefills method, url and headers from the flow", () => {
    render(<ReplayModal detail={detail} onClose={() => {}} />);
    expect((screen.getByDisplayValue("https://api.soum.sa/v2/x?q=1") as HTMLInputElement)).toBeInTheDocument();
    expect(screen.getByDisplayValue("accept")).toBeInTheDocument();
  });

  it("sends edited method + a new header on Send", async () => {
    render(<ReplayModal detail={detail} onClose={() => {}} />);
    fireEvent.change(screen.getByDisplayValue("GET"), { target: { value: "POST" } });
    fireEvent.click(screen.getByText(/Add header/i));
    const keys = screen.getAllByPlaceholderText("Header");
    fireEvent.change(keys[keys.length - 1], { target: { value: "X-Env" } });
    const vals = screen.getAllByPlaceholderText("value");
    fireEvent.change(vals[vals.length - 1], { target: { value: "staging" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(replayEdited).toHaveBeenCalled());
    const id = replayEdited.mock.calls[0][0];
    const edits = replayEdited.mock.calls[0][1] as { method: string; headers: [string, string][] };
    expect(id).toBe("a");
    expect(edits.method).toBe("POST");
    expect(edits.headers).toContainEqual(["X-Env", "staging"]);
  });

  it("unchecking a header excludes it from the send", async () => {
    render(<ReplayModal detail={detail} onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText("include accept"));   // toggle off
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(replayEdited).toHaveBeenCalled());
    const edits = replayEdited.mock.calls[0][1] as { headers: [string, string][] };
    expect(edits.headers).toEqual([]);
  });
});
