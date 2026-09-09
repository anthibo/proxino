import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useStore } from "../src/store";
import { BreakpointsModal } from "../src/components/BreakpointsModal";
const save = vi.fn().mockImplementation(async (b) => b);
vi.mock("../src/api", () => ({ saveBreakpoints: (b: unknown) => save(b), fetchBreakpoints: vi.fn().mockResolvedValue({ enabled: true, rules: [] }) }));
test("add rule requires at least one of host/path/method and saves", async () => {
  useStore.getState().setBreakpoints({ enabled: true, rules: [] });
  render(<BreakpointsModal onClose={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /add rule/i }));
  fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
  expect(screen.getByText(/set a host, path or method/i)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/host/i), { target: { value: "*.soum.sa" } });
  fireEvent.change(screen.getByLabelText(/phase/i), { target: { value: "request" } });
  fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  const b = save.mock.calls[0][0];
  expect(b.rules[0]).toMatchObject({ host: "*.soum.sa", phase: "request", enabled: true });
  expect(typeof b.rules[0].id).toBe("string");
});
test("toggle enabled and delete rule", async () => {
  useStore.getState().setBreakpoints({ enabled: true, rules: [{ id: "r1", enabled: true, host: "a", path: "", method: "", phase: "both" }] });
  render(<BreakpointsModal onClose={() => {}} />);
  fireEvent.click(screen.getByLabelText(/breakpoints enabled/i));
  fireEvent.click(screen.getByRole("button", { name: /delete rule/i }));
  fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
  await waitFor(() => expect(save).toHaveBeenLastCalledWith({ enabled: false, rules: [] }));
});
