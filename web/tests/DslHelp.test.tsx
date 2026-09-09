import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DslHelp } from "../src/components/DslHelp";
describe("DslHelp", () => {
  it("lists fields, operators, and an example", () => {
    render(<DslHelp />);
    expect(screen.getByText(/method/)).toBeInTheDocument();
    expect(screen.getByText(/wildcard/i)).toBeInTheDocument();
    expect(screen.getByText(/status:>=400/)).toBeInTheDocument();
  });
  it("mentions the type:ws filter for websocket flows", () => {
    render(<DslHelp />);
    expect(screen.getByText(/type:ws/)).toBeInTheDocument();
  });
});
