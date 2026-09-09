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

test("empty or out-of-range status shows an inline error and disables Continue", () => {
  const e2 = { ...entry, phase: "response" as const, flow: { ...detail, state: "paused_response", response: { status: 200, reason: "OK", headers: [], size: 2, content_type: "application/json", body: "{}" } } };
  render(<PausedEditor entry={e2} />);
  fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "" } });
  expect(screen.getByText(/status must be a number between 100 and 599/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^continue$/i })).toBeDisabled();

  fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "503" } });
  expect(screen.queryByText(/status must be a number between 100 and 599/i)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^continue$/i })).not.toBeDisabled();
});

test("removing and re-adding a header among several reorders the set but sends no headers edit", async () => {
  const e3 = {
    ...entry,
    flow: { ...detail, request: { ...detail.request, headers: [["content-type", "application/json"], ["x-test", "1"]] as [string, string][] } },
  };
  render(<PausedEditor entry={e3} />);
  const delButtons = screen.getAllByRole("button", { name: /remove header/i });
  fireEvent.click(delButtons[0]); // remove content-type, leaving x-test
  fireEvent.click(screen.getByRole("button", { name: /add header/i })); // re-add a row at the end
  const keyInputs = screen.getAllByPlaceholderText("Header");
  const valInputs = screen.getAllByPlaceholderText("value");
  fireEvent.change(keyInputs[keyInputs.length - 1], { target: { value: "content-type" } });
  fireEvent.change(valInputs[valInputs.length - 1], { target: { value: "application/json" } });
  // Effective set is now [x-test:1, content-type:application/json] -- same
  // members as the original [content-type:application/json, x-test:1], just
  // reordered -- so no edit should be sent.
  fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
  // toHaveBeenLastCalledWith (not toHaveBeenCalledWith): the shared `resume`
  // mock accumulates calls across tests in this file, and an earlier test
  // already calls resume with ("p", undefined) -- asserting only membership
  // in the call history would pass even if this test's own Continue click
  // sent a spurious `headers` edit.
  await waitFor(() => expect(resume).toHaveBeenLastCalledWith("p", undefined));
});
