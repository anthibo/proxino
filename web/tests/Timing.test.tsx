import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Timing } from "../src/components/Timing";

const t = { start: 1, req_done: 1, resp_start: 1, resp_done: 1, duration_ms: 200, connect_ms: 20, tls_ms: 30, ttfb_ms: 140, download_ms: 10 };

describe("Timing", () => {
  it("renders rows for non-null phases with ms values", () => {
    render(<Timing timing={t as any} />);
    expect(screen.getByText(/Waiting/i)).toBeInTheDocument();
    expect(screen.getByText("140 ms")).toBeInTheDocument();
    expect(screen.getByText("20 ms")).toBeInTheDocument();   // connect
  });
  it("shows a message when no timing data", () => {
    render(<Timing timing={{ ...t, connect_ms: null, tls_ms: null, ttfb_ms: null, download_ms: null } as any} />);
    expect(screen.getByText(/no timing data/i)).toBeInTheDocument();
  });
});
