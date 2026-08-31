import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Settings } from "../src/components/Settings";

vi.mock("../src/api", () => ({
  caInfo: () => Promise.resolve({ present: true, fingerprint_sha256: "9F:2A:17", cert_url: "http://mitm.it" }),
}));

describe("Settings", () => {
  it("shows ports and the CA fingerprint from caInfo", async () => {
    render(<Settings onClose={() => {}} />);
    expect(screen.getByText(/8080/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/9F:2A:17/)).toBeInTheDocument());
    expect(screen.getByText(/mitm\.it/)).toBeInTheDocument();
  });
});
