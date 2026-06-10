import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "../../../pages/Home";

describe("Home", () => {
  it("renders the title", () => {
    render(<Home />);
    expect(screen.getByText("机电仿真平台")).toBeInTheDocument();
  });

  it("renders the welcome text", () => {
    render(<Home />);
    expect(screen.getByText("欢迎使用 MechSim 仿真平台")).toBeInTheDocument();
  });
});
