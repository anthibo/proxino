import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useStore } from "../src/store";
import { WsMessages } from "../src/components/WsMessages";
vi.mock("../src/api", () => ({ fetchWsMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }) }));
const m = (i: number, dir: "in" | "out", text: string | null, extra = {}) =>
  ({ i, t: 1700000000 + i, dir, type: (text == null ? "binary" : "text") as "text" | "binary", size: text?.length ?? 4, text, view: null, pretty: null, ...extra });
test("lists frames, filters by direction, expands pretty", async () => {
  useStore.getState().setWsMessages("w", [m(0, "out", '{"a":1}', { view: "json", pretty: '{\n  "a": 1\n}' }), m(1, "in", "pong"), m(2, "in", null)]);
  render(<WsMessages flowId="w" />);
  expect(await screen.findAllByRole("row")).toHaveLength(3);
  expect(screen.getByText("binary · 4 B")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^in$/i }));
  expect(screen.getAllByRole("row")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: /^all$/i }));
  fireEvent.click(screen.getByText('{"a":1}'));
  expect(screen.getByText(/"a": 1/)).toBeInTheDocument();
  expect(screen.getByText("json")).toBeInTheDocument();
});
test("search narrows rows", async () => {
  useStore.getState().setWsMessages("w", [m(0, "out", "hello there"), m(1, "in", "pong")]);
  render(<WsMessages flowId="w" />);
  await screen.findAllByRole("row");
  fireEvent.change(screen.getByPlaceholderText(/search frames/i), { target: { value: "pong" } });
  expect(screen.getAllByRole("row")).toHaveLength(1);
});
test("search matches pretty content for frames with no plain text", async () => {
  useStore.getState().setWsMessages("w", [
    m(0, "out", null, { view: "msgpack", pretty: '{\n  "needle": true\n}' }),
    m(1, "in", "haystack only"),
  ]);
  render(<WsMessages flowId="w" />);
  await screen.findAllByRole("row");
  fireEvent.change(screen.getByPlaceholderText(/search frames/i), { target: { value: "needle" } });
  expect(screen.getAllByRole("row")).toHaveLength(1);
});
test("shows 'No frames yet' when there are no frames, without adding a row", async () => {
  useStore.getState().setWsMessages("w", []);
  render(<WsMessages flowId="w" />);
  await waitFor(() => expect(screen.getByText("No frames yet")).toBeInTheDocument());
  expect(screen.queryAllByRole("row")).toHaveLength(0);
});
test("scrolling up unchecks follow; re-checking re-enables it", async () => {
  useStore.getState().setWsMessages("w", [m(0, "out", "a"), m(1, "in", "b")]);
  render(<WsMessages flowId="w" />);
  await screen.findAllByRole("row");
  const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
  expect(checkbox.checked).toBe(true);
  const list = document.querySelector(".wsm-list") as HTMLDivElement;
  Object.defineProperty(list, "scrollTop", { value: 0, configurable: true });
  Object.defineProperty(list, "clientHeight", { value: 100, configurable: true });
  Object.defineProperty(list, "scrollHeight", { value: 500, configurable: true });
  fireEvent.scroll(list);
  await waitFor(() => expect(checkbox.checked).toBe(false));
  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(true);
});
