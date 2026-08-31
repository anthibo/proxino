import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClientsSidebar } from "../src/components/ClientsSidebar";
import { useStore } from "../src/store";

vi.mock("../src/api", () => ({ setClientLabel: vi.fn(() => Promise.resolve({})) }));
import { setClientLabel } from "../src/api";

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
