import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import type { SweepOps } from "./types";

export function groupMenuItems(
  gi: number, rowCount: number, ops: SweepOps, sweepId: number,
  onAddCol: (gi: number, ri: number) => void, extraKeys: string[], close: () => void,
): MenuProps["items"] {
  const items: MenuProps["items"] = [
    { key: "add-row", label: "插入分组行", icon: <PlusOutlined />,
      onClick: () => { ops.addRow(sweepId, gi, rowCount - 1); close(); } },
    { key: "add-group", label: "插入独立行", icon: <PlusOutlined />,
      onClick: () => { ops.addGroup(sweepId, gi); close(); } },
    { type: "divider" },
    { key: "add-col", label: "插入列", icon: <PlusOutlined />,
      onClick: () => { close(); onAddCol(gi, 0); } },
    { type: "divider" },
    { key: "del-group", label: "删除此分组", icon: <DeleteOutlined />, danger: true,
      onClick: () => { ops.deleteGroup(sweepId, gi); close(); } },
  ];
  if (extraKeys.length > 0) {
    items!.push({ type: "divider" });
    for (const k of extraKeys) {
      items!.push({ key: `del-col-${k}`, label: `删除列「${k}」`, icon: <DeleteOutlined />, danger: true,
        onClick: () => { ops.deleteColumn(sweepId, k); close(); } });
    }
  }
  return items;
}

export function dataMenuItems(
  gi: number, ri: number, ops: SweepOps, sweepId: number,
  onAddCol: (gi: number, ri: number) => void, extraKeys: string[], close: () => void,
): MenuProps["items"] {
  const items: MenuProps["items"] = [
    { key: "add-group", label: "插入独立行", icon: <PlusOutlined />,
      onClick: () => { ops.addGroup(sweepId, gi); close(); } },
    { key: "add-row", label: "插入分组行", icon: <PlusOutlined />,
      onClick: () => { ops.addRow(sweepId, gi, ri); close(); } },
    { type: "divider" },
    { key: "add-col", label: "插入列", icon: <PlusOutlined />,
      onClick: () => { close(); onAddCol(gi, ri); } },
    { type: "divider" },
    { key: "del-row", label: "删除此行", icon: <DeleteOutlined />, danger: true,
      onClick: () => { ops.deleteRow(sweepId, gi, ri); close(); } },
  ];
  if (extraKeys.length > 0) {
    items!.push({ type: "divider" });
    for (const k of extraKeys) {
      items!.push({ key: `del-col-${k}`, label: `删除列「${k}」`, icon: <DeleteOutlined />, danger: true,
        onClick: () => { ops.deleteColumn(sweepId, k); close(); } });
    }
  }
  return items;
}
