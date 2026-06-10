import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TreeNode from "../../../mechSim/components/TreeNode";

describe("TreeNode", () => {
  const baseProps = {
    name: "root",
    value: { a: 1, b: 2 },
    path: "root",
    selPath: "",
    expanded: {},
    onToggle: vi.fn(),
    onSelect: vi.fn(),
  };

  it("renders the node name", () => {
    render(<TreeNode {...baseProps} />);
    expect(screen.getByText("root")).toBeInTheDocument();
  });

  it("hides leaf children when all values are primitives", () => {
    render(<TreeNode {...baseProps} />);
    expect(screen.queryByText("a")).not.toBeInTheDocument();
    expect(screen.queryByText("b")).not.toBeInTheDocument();
  });

  it("shows children when values contain objects", () => {
    const props = {
      ...baseProps,
      value: { group: { x: 1 } },
      expanded: { root: true },
    };
    render(<TreeNode {...props} />);
    expect(screen.getByText("group")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(<TreeNode {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("root"));
    expect(onSelect).toHaveBeenCalledWith("root");
  });

  it("applies selected class when selPath matches", () => {
    render(<TreeNode {...baseProps} selPath="root" />);
    const label = screen.getByText("root").closest("label");
    expect(label?.className).toContain("selected");
  });

  it("filters _labels, _units, ID from children", () => {
    const props = {
      ...baseProps,
      value: {
        _labels: { a: "Label" },
        _units: { a: "m" },
        ID: 1,
        real: { x: 1 },
      },
      expanded: { root: true },
    };
    render(<TreeNode {...props} />);
    expect(screen.queryByText("_labels")).not.toBeInTheDocument();
    expect(screen.queryByText("_units")).not.toBeInTheDocument();
    expect(screen.queryByText("ID")).not.toBeInTheDocument();
    expect(screen.getByText("real")).toBeInTheDocument();
  });
});
