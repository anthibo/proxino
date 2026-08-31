import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlowTable } from "../src/components/FlowTable";
import { useStore } from "../src/store";
import type { FlowMeta } from "../src/types";

const mk = (id: string, o: Partial<FlowMeta> = {}): FlowMeta => ({
  id, timestamp: 1, client: { ip: "1.1.1.1", label: "x" }, method: "GET",
  scheme: "https", host: "api.soum.sa", port: 443, path: "/v2/" + id, query: "",
  http_version: "HTTP/2", request: { headers: [], size: 0 },
  response: { status: 200, reason: "", headers: [], size: 0, content_type: "application/json" },
  duration_ms: 1, state: "complete", error: null, ...o,
});

describe("FlowTable", () => {
  beforeEach(() => useStore.getState().clear());
  it("renders visible rows with host and path", () => {
    useStore.getState().upsertFlow(mk("42", { path: "/v2/listings" }));
    render(<FlowTable />);
    expect(screen.getByText("/v2/listings")).toBeInTheDocument();
    expect(screen.getByText("api.soum.sa")).toBeInTheDocument();
  });
  it("shows empty state when no flows", () => {
    render(<FlowTable />);
    expect(screen.getByText(/waiting for traffic/i)).toBeInTheDocument();
  });
  it("renders column headers and TYPE + SIZE cells", () => {
    useStore.getState().upsertFlow(mk("7", {
      response: { status: 200, reason: "OK", headers: [], size: 4096, content_type: "image/webp" },
    }));
    render(<FlowTable />);
    expect(screen.getByText("METHOD")).toBeInTheDocument();
    expect(screen.getByText("SIZE")).toBeInTheDocument();
    expect(screen.getByText("webp")).toBeInTheDocument();       // TYPE cell
    expect(screen.getByText("4.0 KB")).toBeInTheDocument();     // SIZE cell
  });
});
