import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { PausedEditor } from "../src/components/PausedEditor";
const resume = vi.fn().mockResolvedValue({ ok: true, modified: true }); const drop = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../src/api", () => ({ resumePaused: (id: string, e?: unknown) => resume(id, e), dropPaused: (id: string) => drop(id) }));
const detail: any = { id: "p", method: "POST", scheme: "https", host: "api.soum.sa", port: 443, path: "/v2/x", query: "", request: { headers: [["content-type", "application/json"]], size: 2, body: "{}" }, response: null, state: "paused_request", timing: {} };
const entry = { flow_id: "p", phase: "request" as const, rule_id: "r", since: 0, deadline: Date.now() / 1000 + 45, flow: detail };
test("continue sends only changed fields", async () => {
  render(<PausedEditor entry={entry} />);
  expect(screen.getByText(/request paused/i)).toBeInTheDocument();
  expect(screen.getByText(/auto-continues in 4\ds/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/^body$/i), { target: { value: '{"edited":true}' } });
  fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
  await waitFor(() => expect(resume).toHaveBeenCalledWith("p", { body: '{"edited":true}' }));
});
test("continue unchanged and drop", async () => {
  render(<PausedEditor entry={entry} />);
  fireEvent.click(screen.getByRole("button", { name: /continue unchanged/i }));
  await waitFor(() => expect(resume).toHaveBeenCalledWith("p", undefined));
  fireEvent.click(screen.getByRole("button", { name: /^drop$/i }));
  await waitFor(() => expect(drop).toHaveBeenCalledWith("p"));
});
test("response phase edits status", async () => {
  const e2 = { ...entry, phase: "response" as const, flow: { ...detail, state: "paused_response", response: { status: 200, reason: "OK", headers: [], size: 2, content_type: "application/json", body: "{}" } } };
  render(<PausedEditor entry={e2} />);
  fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "503" } });
  fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
  await waitFor(() => expect(resume).toHaveBeenCalledWith("p", { status: 503 }));
});
