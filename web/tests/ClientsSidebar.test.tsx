import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ClientsSidebar } from "../src/components/ClientsSidebar";
import { useStore } from "../src/store";

vi.mock("../src/api", () => ({
  setClientLabel: vi.fn(() => Promise.resolve({})),
  removePassthrough: vi.fn(() => Promise.resolve({ removed: true })),
  fetchPassthrough: vi.fn(() => Promise.resolve([])),
}));
import { setClientLabel, removePassthrough, fetchPassthrough } from "../src/api";

const mk = (ip: string, label: string) => ({
  id: ip, timestamp: 1, client: { ip, label }, method: "GET", scheme: "https",
  host: "h", port: 443, path: "/", query: "", http_version: "HTTP/2",
  request: { headers: [], size: 0 }, response: null, duration_ms: null, state: "pending", error: null,
});

describe("inline label edit", () => {
  beforeEach(() => { vi.clearAllMocks(); useStore.getState().clear(); useStore.getState().upsertFlow(mk("1.1.1.1","iPhone") as any); });
  it("double-click edits and Enter saves", () => {
    render(<ClientsSidebar />);
    fireEvent.doubleClick(screen.getByText("iPhone"));
    const input = screen.getByDisplayValue("iPhone");
    fireEvent.change(input, { target: { value: "My Phone" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(setClientLabel).toHaveBeenCalledWith("1.1.1.1", "My Phone");
    expect(screen.getByText("My Phone")).toBeInTheDocument();
  });
  it("commits the label edit on blur", () => {
    useStore.getState().clear();
    useStore.getState().upsertFlow(mk("1.1.1.1", "iPhone") as any);
    render(<ClientsSidebar />);
    fireEvent.doubleClick(screen.getByText("iPhone"));
    const input = screen.getByDisplayValue("iPhone");
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.blur(input);
    expect(setClientLabel).toHaveBeenCalledWith("1.1.1.1", "Renamed");
  });
  it("Escape cancels the rename without saving", () => {
    useStore.getState().clear();
    useStore.getState().upsertFlow(mk("1.1.1.1", "iPhone") as any);
    render(<ClientsSidebar />);
    fireEvent.doubleClick(screen.getByText("iPhone"));
    const input = screen.getByDisplayValue("iPhone");
    fireEvent.change(input, { target: { value: "Nope" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(setClientLabel).not.toHaveBeenCalled();
    expect(screen.getByText("iPhone")).toBeInTheDocument();
  });
});

describe("passthrough section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.getState().clear();
    useStore.getState().setPassthrough([]);
    vi.mocked(fetchPassthrough).mockResolvedValue([]);
    vi.mocked(removePassthrough).mockResolvedValue({ removed: true });
  });

  it("renders nothing when there are no passthrough hosts", () => {
    render(<ClientsSidebar />);
    expect(screen.queryByText("PASSTHROUGH")).not.toBeInTheDocument();
  });

  it("renders the passthrough section from store state, hiding Retry for config rows", () => {
    useStore.getState().setPassthrough([
      { host: "pinned.example.com", source: "auto", active: true, failures: 2, clients: ["1.1.1.1"], first_seen: 1, last_seen: 2 },
      { host: "gs.itunes.apple.com", source: "config", active: true, failures: 1, clients: ["2.2.2.2"], first_seen: 1, last_seen: 2 },
    ]);
    render(<ClientsSidebar />);
    expect(screen.getByText("PASSTHROUGH")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();   // both are active
    expect(screen.getByText("pinned.example.com")).toBeInTheDocument();
    expect(screen.getByText("pinned · 2 refused")).toBeInTheDocument();

    const configRow = screen.getByText("gs.itunes.apple.com").closest(".pth-row") as HTMLElement;
    expect(within(configRow).queryByText("Retry")).not.toBeInTheDocument();
    expect(within(configRow).getByText("config", { selector: ".pth-tag" })).toBeInTheDocument();

    const autoRow = screen.getByText("pinned.example.com").closest(".pth-row") as HTMLElement;
    expect(within(autoRow).getByText("Retry")).toBeInTheDocument();
  });

  it("renders a watching (not-yet-active) row without Retry, and excludes it from the header count", () => {
    useStore.getState().setPassthrough([
      { host: "pinned.example.com", source: "auto", active: true, failures: 2, clients: ["1.1.1.1"], first_seen: 1, last_seen: 2 },
      { host: "maybe.example.com", source: "auto", active: false, failures: 1, clients: ["3.3.3.3"], first_seen: 1, last_seen: 2 },
    ]);
    render(<ClientsSidebar />);
    // header count only counts the active host
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("maybe.example.com")).toBeInTheDocument();
    expect(screen.getByText("watching · 1 refused")).toBeInTheDocument();
    const watchingRow = screen.getByText("maybe.example.com").closest(".pth-row") as HTMLElement;
    expect(within(watchingRow).queryByText("Retry")).not.toBeInTheDocument();
  });

  it("calls DELETE /api/passthrough/{host} on Retry and refreshes store from the follow-up GET", async () => {
    useStore.getState().setPassthrough([
      { host: "pinned.example.com", source: "auto", active: true, failures: 2, clients: ["1.1.1.1"], first_seen: 1, last_seen: 2 },
    ]);
    const refreshed = [
      { host: "other.example.com", source: "auto" as const, active: true, failures: 2, clients: ["9.9.9.9"], first_seen: 3, last_seen: 4 },
    ];
    vi.mocked(fetchPassthrough).mockResolvedValueOnce(refreshed);
    render(<ClientsSidebar />);
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => expect(removePassthrough).toHaveBeenCalledWith("pinned.example.com"));
    await waitFor(() => expect(fetchPassthrough).toHaveBeenCalled());
    await waitFor(() => expect(useStore.getState().passthrough).toEqual(refreshed));
  });

  it("keeps the row and shows an inline error when the DELETE fails", async () => {
    useStore.getState().setPassthrough([
      { host: "pinned.example.com", source: "auto", active: true, failures: 2, clients: ["1.1.1.1"], first_seen: 1, last_seen: 2 },
    ]);
    vi.mocked(removePassthrough).mockRejectedValueOnce(new Error("409"));
    render(<ClientsSidebar />);
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => expect(removePassthrough).toHaveBeenCalledWith("pinned.example.com"));
    // row survives the failure
    expect(screen.getByText("pinned.example.com")).toBeInTheDocument();
    // and a short inline error appears instead of failing silently
    const row = screen.getByText("pinned.example.com").closest(".pth-row") as HTMLElement;
    await waitFor(() => expect(within(row).getByText(/couldn.?t remove|retry failed|error/i)).toBeInTheDocument());
    expect(fetchPassthrough).not.toHaveBeenCalled();
  });
});
