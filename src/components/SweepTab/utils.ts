import type { SweepRow, SweepItem, EditTarget, TreeRow } from "./types";
import { message } from "antd";

// ── Helpers ──

export const FIXED_KEYS = new Set(["vars", "type", "initValue", "iterValue", "isSim", "simTraj"]);

export function defaultRow(): SweepRow {
  return { vars: [], type: "Q", initValue: "", iterValue: "", isSim: true, simTraj: true };
}

export function coerceValue(v: string): unknown {
  const t = v.trim();
  if (t === "") return v;
  const n = Number(t);
  return Number.isNaN(n) ? v : n;
}

export function sameEdit(a: EditTarget | null, b: EditTarget | null): boolean {
  if (!a || !b || a.kind !== b.kind || a.sweepId !== b.sweepId) return false;
  if (a.kind === "sweepName") return true;
  return a.groupIndex === (b as typeof a).groupIndex
    && a.rowIndex === (b as typeof a).rowIndex
    && a.field === (b as typeof a).field;
}

export function exportJson(data: SweepItem[]): void {
  const clean = data.map(({ id, name, groups }) => ({
    id,
    name,
    groups: groups.map((group) =>
      group.map((row) => {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(row)) out[key] = row[key];
        return out;
      }),
    ),
  }));
  const blob = new Blob([JSON.stringify(clean, null, 4)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "SweepData.json";
  a.click();
  URL.revokeObjectURL(url);
  message.success("导出成功");
}

/** SweepRow → TreeRow */
export function rowToTreeRow(row: SweepRow, gi: number, ri: number): TreeRow {
  const extras: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    if (!FIXED_KEYS.has(k)) extras[k] = row[k];
  }
  return {
    key: `g${gi}-r${ri}`, isGroup: false, gi, ri,
    _vars: row.vars, _type: row.type, _initValue: row.initValue,
    _iterValue: row.iterValue, _isSim: row.isSim, _simTraj: row.simTraj, _extras: extras,
  };
}

/** groups → antd tree dataSource */
export function buildTreeData(groups: SweepRow[][]): TreeRow[] {
  return groups.map((group, gi) => ({
    key: `g${gi}`, isGroup: true, gi, ri: -1,
    children: (group.length > 0 ? group : [defaultRow()]).map((row, ri) => rowToTreeRow(row, gi, ri)),
  }));
}

/** 从 TreeRow 读取字段值（仅数据行） */
export function rowVal(record: TreeRow, field: string): unknown {
  switch (field) {
    case "vars": return record._vars;
    case "type": return record._type;
    case "initValue": return record._initValue;
    case "iterValue": return record._iterValue;
    case "isSim": return record._isSim;
    case "simTraj": return record._simTraj;
    default: return record._extras?.[field];
  }
}

/** 从 modelInfo[version][sysName].variables 中提取所有叶子路径 */
export function extractParamPaths(
  modelInfo: Record<string, Record<string, { variables?: Record<string, unknown> }>> | undefined,
  version: string, sysName: string,
): string[] {
  if (!modelInfo || !sysName) return [];
  const variables = modelInfo[version || "3X"]?.[sysName]?.variables;
  if (!variables) return [];
  const paths: string[] = [];
  function walk(obj: unknown, prefix: string) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
    const entries = Object.entries(obj as Record<string, unknown>)
      .filter(([k]) => k !== "_labels" && k !== "_units");
    if (entries.length === 0) { paths.push(prefix); return; }
    const hasNested = entries.some(([, v]) => v && typeof v === "object" && !Array.isArray(v));
    if (!hasNested) { paths.push(prefix); return; }
    for (const [k, v] of entries) walk(v, prefix ? `${prefix}.${k}` : k);
  }
  walk(variables, "");
  return [...new Set(paths)].sort();
}
