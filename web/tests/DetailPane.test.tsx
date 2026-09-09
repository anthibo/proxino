import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
