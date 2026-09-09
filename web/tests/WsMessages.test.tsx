import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { useStore } from "../src/store";
import { WsMessages } from "../src/components/WsMessages";
vi.mock("../src/api", () => ({ fetchWsMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }) }));
const m = (i: number, dir: "in" | "out", text: string | null, extra = {}) =>
  ({ i, t: 1700000000 + i, dir, type: (text == null ? "binary" : "text") as "text" | "binary", size: text?.length ?? 4, text, view: null, pretty: null, ...extra });
test("lists frames, filters by direction, expands pretty", () => {
  useStore.getState().setWsMessages("w", [m(0, "out", '{"a":1}', { view: "json", pretty: '{\n  "a": 1\n}' }), m(1, "in", "pong"), m(2, "in", null)]);
  render(<WsMessages flowId="w" />);
  expect(screen.getAllByRole("row")).toHaveLength(3);
  expect(screen.getByText("binary · 4 B")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^in$/i }));
  expect(screen.getAllByRole("row")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: /^all$/i }));
  fireEvent.click(screen.getByText('{"a":1}'));
  expect(screen.getByText(/"a": 1/)).toBeInTheDocument();
  expect(screen.getByText("json")).toBeInTheDocument();
});
test("search narrows rows", () => {
  useStore.getState().setWsMessages("w", [m(0, "out", "hello there"), m(1, "in", "pong")]);
  render(<WsMessages flowId="w" />);
  fireEvent.change(screen.getByPlaceholderText(/search frames/i), { target: { value: "pong" } });
  expect(screen.getAllByRole("row")).toHaveLength(1);
});
