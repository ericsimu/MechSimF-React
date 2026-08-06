// ── Types ──

export interface SweepRow {
  vars: string[];
  type: string;
  initValue: string;
  iterValue: string;
  isSim: boolean;
  simTraj: boolean;
  [key: string]: unknown;
}

export interface SweepItem {
  id: number;
  name: string;
  groups: SweepRow[][];
}

export type EditTarget =
  | { kind: "sweepName"; sweepId: number }
  | { kind: "groupText"; sweepId: number; groupIndex: number; rowIndex: number; field: string }
  | { kind: "extra"; sweepId: number; groupIndex: number; rowIndex: number; field: string };

export interface SweepOps {
  setGroupKey: (sweepId: number, gi: number, ri: number, key: string, value: unknown) => void;
  updateVars: (sweepId: number, gi: number, ri: number, vars: string[]) => void;
  updateSweepName: (sweepId: number, name: string) => void;
  addGroup: (sweepId: number, afterIndex: number) => void;
  deleteGroup: (sweepId: number, gi: number) => void;
  addRow: (sweepId: number, gi: number, afterRowIndex: number) => void;
  deleteRow: (sweepId: number, gi: number, ri: number) => void;
  setExtra: (sweepId: number, gi: number, ri: number, key: string, value: string) => void;
  deleteColumn: (sweepId: number, key: string) => void;
}

/** antd tree table 行数据 */
export interface TreeRow {
  key: string;
  isGroup: boolean;
  gi: number;
  ri: number;
  children?: TreeRow[];
  _vars?: string[];
  _type?: string;
  _initValue?: string;
  _iterValue?: string;
  _isSim?: boolean;
  _simTraj?: boolean;
  _extras?: Record<string, unknown>;
}
