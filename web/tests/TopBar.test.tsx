import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBar } from "../src/components/TopBar";
import { useStore } from "../src/store";

vi.mock("../src/api", () => ({
  clearFlows: vi.fn(() => Promise.resolve({ ok: true })),
  download: vi.fn(),
  fetchFlows: vi.fn(() => Promise.resolve([])),
  loadSession: vi.fn(() => Promise.resolve({})),
  caInfo: vi.fn(() => Promise.resolve({ present: true })),
  fetchConnectInfo: vi.fn(() => Promise.resolve({ proxy_hint: "127.0.0.1:8080" })),
}));

describe("TopBar passthrough pill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.getState().clear();
    useStore.getState().setPassthrough([]);
  });

  it("hides the pill when there are no passthrough hosts", () => {
    render(<TopBar onConnect={() => {}} />);
    expect(screen.queryByText(/passthrough/)).not.toBeInTheDocument();
  });

  it("counts only active hosts, excluding watching ones", () => {
    useStore.getState().setPassthrough([
      { host: "pinned.example.com", source: "auto", active: true, failures: 2, clients: ["1.1.1.1"], first_seen: 1, last_seen: 2 },
      { host: "watching.example.com", source: "auto", active: false, failures: 1, clients: ["2.2.2.2"], first_seen: 1, last_seen: 2 },
    ]);
    render(<TopBar onConnect={() => {}} />);
    expect(screen.getByText("1 passthrough")).toBeInTheDocument();
  });

  it("hides the pill entirely when every host is still only watching", () => {
    useStore.getState().setPassthrough([
      { host: "watching.example.com", source: "auto", active: false, failures: 1, clients: ["2.2.2.2"], first_seen: 1, last_seen: 2 },
    ]);
    render(<TopBar onConnect={() => {}} />);
    expect(screen.queryByText(/passthrough/)).not.toBeInTheDocument();
  });
});

describe("TopBar window drag region (Tauri desktop shell)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.getState().clear();
  });

  it("marks the root topbar element as a Tauri drag region", () => {
    const { container } = render(<TopBar onConnect={() => {}} />);
    const topbar = container.querySelector(".topbar");
    expect(topbar).toHaveAttribute("data-tauri-drag-region");
  });

  it("marks the brand span as a Tauri drag region", () => {
    const { container } = render(<TopBar onConnect={() => {}} />);
    expect(container.querySelector(".brand")).toHaveAttribute("data-tauri-drag-region");
  });
});
