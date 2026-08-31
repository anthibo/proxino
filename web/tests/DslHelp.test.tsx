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
});
