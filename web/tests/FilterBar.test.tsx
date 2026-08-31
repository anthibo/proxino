import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterBar } from "../src/components/FilterBar";
import { useStore } from "../src/store";

describe("FilterBar", () => {
  beforeEach(() => useStore.getState().clear());
  it("typing updates the store query", () => {
    render(<FilterBar />);
    fireEvent.change(screen.getByPlaceholderText(/status:/i), { target: { value: "status:>=400" } });
    expect(useStore.getState().query).toBe("status:>=400");
  });
  it("errors-only chip sets query", () => {
    render(<FilterBar />);
    fireEvent.click(screen.getByText(/errors only/i));
    expect(useStore.getState().query).toContain("status:>=400");
  });
});

describe("FilterBar quick method chips", () => {
  beforeEach(() => useStore.getState().clear());
  it("clicking GET sets the method query and marks it active", () => {
    render(<FilterBar />);
    const get = screen.getByRole("button", { name: "GET" });
    fireEvent.click(get);
    expect(useStore.getState().query).toBe("method:GET");
    expect(get.className).toContain("active");
  });
  it("4xx sets a status range and All clears everything", () => {
    render(<FilterBar />);
    fireEvent.click(screen.getByRole("button", { name: "4xx" }));
    expect(useStore.getState().query).toBe("status:>=400 status:<=499");
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(useStore.getState().query).toBe("");
    expect(screen.getByRole("button", { name: "All" }).className).toContain("active");
  });
});

describe("FilterBar autocomplete + chips", () => {
  beforeEach(() => { useStore.getState().clear(); localStorage.clear(); });
  it("shows suggestions and applies one on click", () => {
    render(<FilterBar />);
    const input = screen.getByPlaceholderText(/status:/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "meth" } });
    fireEvent.click(screen.getByText("method:"));
    expect(useStore.getState().query).toBe("method:");
  });
  it("renders active chips and removes one", () => {
    render(<FilterBar />);
    fireEvent.change(screen.getByPlaceholderText(/status:/i), { target: { value: "host:*.soum.sa status:>=400" } });
    const chip = screen.getByText("status:>=400");
    fireEvent.click(chip.querySelector("button")!);         // remove the chip
    expect(useStore.getState().query.trim()).toBe("host:*.soum.sa");
  });
});
