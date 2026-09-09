import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JsonView } from "../src/components/JsonView";

const body = JSON.stringify({ order: { id: "o1", paid: true, items: [1, 2] }, coupon: null });

describe("JsonView", () => {
  it("renders keys and typed values with color classes", () => {
    const { container } = render(<JsonView body={body} contentType="application/json" />);
    expect(screen.getByText(/"order"/)).toBeInTheDocument();
    expect(screen.getByText("true")).toHaveClass("jv-boolean");
    expect(screen.getByText("null")).toHaveClass("jv-null");
  });
  it("collapses a container on click, hiding its children", () => {
    render(<JsonView body={body} contentType="application/json" />);
    expect(screen.getByText(/"id"/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/"order"/));      // collapse the order object
    expect(screen.queryByText(/"id"/)).toBeNull();     // children hidden
    expect(screen.getByText(/keys/)).toBeInTheDocument(); // collapsed summary shown
  });
  it("falls back to raw text for non-JSON", () => {
    render(<JsonView body={"not json"} contentType="text/plain" />);
    expect(screen.getByText("not json")).toBeInTheDocument();
  });
  it("shows (no body) for null body", () => {
    render(<JsonView body={null} />);
    expect(screen.getByText(/no body/i)).toBeInTheDocument();
  });
  it("shows the RESPONSE BODY label and content-type badge", () => {
    render(<JsonView body={body} contentType="application/json" status={200} reason="OK" />);
    expect(screen.getByText("RESPONSE BODY")).toBeInTheDocument();
    expect(screen.getByText("application/json")).toBeInTheDocument();
  });
  it("renders an error banner for 4xx/5xx responses", () => {
    render(<JsonView body={body} contentType="application/json" status={503} reason="Service Unavailable" />);
    expect(screen.getByText(/503 Service Unavailable/)).toBeInTheDocument();
  });
  it("offers a Preview mode only for HTML and renders a line-number gutter", () => {
    render(<JsonView body={"<html><body>hi</body></html>"} contentType="text/html" status={200} />);
    expect(screen.getByRole("button", { name: "Preview" })).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();   // line-number gutter
  });
  it("has no Preview button for JSON", () => {
    render(<JsonView body={body} contentType="application/json" status={200} />);
    expect(screen.queryByRole("button", { name: "Preview" })).toBeNull();
  });
});

describe("JsonView decoded body view", () => {
  it("shows a view badge and renders the pretty text for a decoded (e.g. protobuf) body", () => {
    render(
      <JsonView
        body={""}
        contentType="application/x-protobuf"
        status={200}
        view="protobuf"
        pretty={"1: 150  # !sint: 75"}
      />
    );
    expect(screen.getByText("protobuf")).toBeInTheDocument();
    expect(screen.getByText(/150/)).toBeInTheDocument();
  });

  it("shows a custom label when provided", () => {
    render(<JsonView label="REQUEST BODY" body={'{"a":1}'} contentType="application/json" />);
    expect(screen.getByText("REQUEST BODY")).toBeInTheDocument();
  });

  it("shows a binary body placeholder in Raw mode when body is null but size is set", () => {
    render(<JsonView body={null} contentType="application/octet-stream" size={42} />);
    fireEvent.click(screen.getByRole("button", { name: "Raw" }));
    expect(screen.getByText(/binary body, 42 bytes/i)).toBeInTheDocument();
  });
});
