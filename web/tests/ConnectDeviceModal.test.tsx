import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConnectDeviceModal } from "../src/components/ConnectDeviceModal";
import { useStore } from "../src/store";
import type { FlowMeta } from "../src/types";

vi.mock("../src/api", () => ({
  fetchConnectInfo: () => Promise.resolve({ proxy_hint: "192.168.1.9:8080", cert_url: "http://mitm.it", proxy_port: 8080, lan_ips: ["192.168.1.9"] }),
}));
vi.mock("qrcode", () => ({ default: { toDataURL: () => Promise.resolve("data:image/png;base64,AAAA") } }));

const mkFlow = (ip: string): FlowMeta => ({
  id: "f-" + ip, timestamp: 1, client: { ip, label: ip }, method: "GET", scheme: "http",
  host: "x", port: 80, path: "/", query: "", http_version: "HTTP/1.1",
  request: { headers: [], size: 0 }, response: null, duration_ms: null, state: "pending", error: null,
});

describe("ConnectDeviceModal", () => {
  beforeEach(() => useStore.getState().clear());

  it("shows the proxy server/port and switches iOS/Android steps", async () => {
    render(<ConnectDeviceModal onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("192.168.1.9")).toBeInTheDocument());
    expect(screen.getByText("8080")).toBeInTheDocument();
    expect(screen.getByText(/Certificate Trust Settings/i)).toBeInTheDocument();   // iOS default
    fireEvent.click(screen.getByRole("button", { name: "Android" }));
    expect(screen.getByText(/Install a certificate/i)).toBeInTheDocument();
  });

  it("waits, then reports a connected device when a non-loopback flow arrives", async () => {
    render(<ConnectDeviceModal onClose={() => {}} />);
    expect(screen.getByText(/Waiting for the first request/i)).toBeInTheDocument();
    useStore.getState().upsertFlow(mkFlow("127.0.0.1"));   // loopback: still waiting
    expect(screen.getByText(/Waiting for the first request/i)).toBeInTheDocument();
    useStore.getState().upsertFlow(mkFlow("192.168.1.42"));
    await waitFor(() => expect(screen.getByText(/Device connected — 192\.168\.1\.42/)).toBeInTheDocument());
  });

  it("renders the CA QR code once generated", async () => {
    render(<ConnectDeviceModal onClose={() => {}} />);
    await waitFor(() => expect(screen.getByAltText(/QR code/i)).toBeInTheDocument());
  });
});
