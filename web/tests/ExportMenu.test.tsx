import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportMenu } from "../src/components/ExportMenu";

describe("ExportMenu", () => {
  it("shows session/export items and fires actions", () => {
    const onSave = vi.fn();
    const onLoad = vi.fn();
    const onExportHar = vi.fn();
    const onClear = vi.fn();
    render(<ExportMenu onSave={onSave} onLoad={onLoad} onExportHar={onExportHar} onClear={onClear} />);
    expect(screen.getByText(/Save session/i)).toBeInTheDocument();
    expect(screen.getByText(/Export as HAR/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Save session/i));
    expect(onSave).toHaveBeenCalled();

    fireEvent.click(screen.getByText(/Load session/i));
    expect(onLoad).toHaveBeenCalled();

    fireEvent.click(screen.getByText(/Export as HAR/i));
    expect(onExportHar).toHaveBeenCalled();

    fireEvent.click(screen.getByText(/Clear session/i));
    expect(onClear).toHaveBeenCalled();
  });
});
