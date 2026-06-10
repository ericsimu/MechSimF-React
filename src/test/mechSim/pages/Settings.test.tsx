import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Settings from "../../../pages/Settings";

describe("Settings", () => {
  it("renders the title", () => {
    render(<Settings />);
    expect(screen.getByText("设置")).toBeInTheDocument();
  });
});
