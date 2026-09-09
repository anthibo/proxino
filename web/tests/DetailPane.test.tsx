import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DetailPane } from "../src/components/DetailPane";
import { useStore } from "../src/store";
import type { FlowDetail } from "../src/types";

const detail: FlowDetail = {
  id: "a", timestamp: 1, client: { ip: "1.1.1.1", label: "x" }, method: "GET",
  scheme: "https", host: "api.soum.sa", port: 443, path: "/v2/x", query: "", http_version: "HTTP/2",
  request: { headers: [["accept", "*/*"]], size: 0, body: null },
  response: { status: 200, reason: "OK", headers: [["content-type", "application/json"]], size: 3, content_type: "application/json", body: '{"ok":true}' },
  duration_ms: 142, state: "complete", error: null,
  timing: { start: 1, req_done: 1, resp_start: 1, resp_done: 143, duration_ms: 142, connect_ms: null, tls_ms: null, ttfb_ms: 100, download_ms: 10 },
};

describe("DetailPane tabs", () => {
  beforeEach(() => useStore.getState().select("a", detail));
  it("Body tab shows the JSON viewer with the response body", () => {
    render(<DetailPane />);
    expect(screen.getByText(/"ok"/)).toBeInTheDocument();   // JsonView rendered the body
  });
  it("switching to Headers shows a header name", () => {
    render(<DetailPane />);
    fireEvent.click(screen.getByRole("button", { name: /Headers/i }));
    expect(screen.getByText(/content-type/)).toBeInTheDocument();
  });
});

describe("DetailPane Body tab request body", () => {
  it("shows both REQUEST BODY and RESPONSE BODY sections for a POST with a JSON request body", () => {
    const postDetail: FlowDetail = {
      ...detail,
      method: "POST",
      request: { headers: [["content-type", "application/json"]], size: 10, body: '{"name":"x"}' },
    };
    useStore.getState().select("a", postDetail);
    render(<DetailPane />);
    expect(screen.getByText("REQUEST BODY")).toBeInTheDocument();
    expect(screen.getByText("RESPONSE BODY")).toBeInTheDocument();
    expect(screen.getByText(/"name"/)).toBeInTheDocument();
    expect(screen.getByText(/"ok"/)).toBeInTheDocument();
  });

  it("shows only RESPONSE BODY for a GET with no request body", () => {
    useStore.getState().select("a", detail);
    render(<DetailPane />);
    expect(screen.queryByText("REQUEST BODY")).not.toBeInTheDocument();
    expect(screen.getByText("RESPONSE BODY")).toBeInTheDocument();
  });

  it("shows a binary-body note for a request with no decoded body but a nonzero size", () => {
    const binaryDetail: FlowDetail = {
      ...detail,
      method: "POST",
      request: { headers: [["content-type", "application/octet-stream"]], size: 2048, body: null },
    };
    useStore.getState().select("a", binaryDetail);
    render(<DetailPane />);
    expect(screen.getByText("REQUEST BODY")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /^Raw$/i })[0]);
    expect(screen.getByText("binary body, 2048 bytes")).toBeInTheDocument();
  });
});

describe("DetailPane live ws meta", () => {
  const wsDetail: FlowDetail = {
    ...detail, id: "w", kind: "ws", response: null,
    ws: { messages: 2, open: true, closed_by: null, close_code: null, close_reason: null },
  };

  it("updates the Overview Frames line from a live upsertFlow without re-selecting", async () => {
    useStore.getState().clear();
    useStore.getState().upsertFlow({ ...wsDetail });
    useStore.getState().select("w", wsDetail);
    render(<DetailPane />);
    fireEvent.click(screen.getByRole("button", { name: /Overview/i }));
    expect(screen.getByText("2 · open")).toBeInTheDocument();
    useStore.getState().upsertFlow({ ...wsDetail, ws: { messages: 7, open: true, closed_by: null, close_code: null, close_reason: null } });
    await waitFor(() => expect(screen.getByText("7 · open")).toBeInTheDocument());
  });

  it("makes the Messages tab reachable once a plain-selected row turns out to be a ws flow", () => {
    // A row can be selected while it is still a pending/plain flow.new event,
    // before the websocket_start update tags it kind: "ws" -- the detail
    // pane must react to that live upgrade even though `detail` itself
    // (fetched once at selection time) is stale.
    useStore.getState().clear();
    const plainMeta = { ...wsDetail, kind: undefined, ws: null };
    useStore.getState().upsertFlow(plainMeta);
    useStore.getState().select("w", plainMeta as FlowDetail);
    useStore.getState().upsertFlow({ ...wsDetail, ws: { messages: 3, open: true, closed_by: null, close_code: null, close_reason: null } });
    render(<DetailPane />);
    expect(screen.getByRole("button", { name: /Messages/i })).toBeInTheDocument();
  });
});
