import type { SweepRow, EditTarget, TreeRow } from "./types";

// ── Helpers ──

export const FIXED_KEYS = new Set(["vars", "type", "initValue", "iterValue", "isSim", "simTraj"]);

export function defaultRow(): SweepRow {
  return { vars: [], type: "Q", initValue: "0", iterValue: "", isSim: true, simTraj: true };
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
  const rows: TreeRow[] = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    if (group.length <= 1) {
      rows.push(rowToTreeRow(group[0] ?? defaultRow(), gi, 0));
    } else {
      for (let ri = 0; ri < group.length; ri++) {
        rows.push(rowToTreeRow(group[ri], gi, ri));
      }
    }
  }
  return rows;
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

/** 从 modelInfo[version][sysName].variables 中提取所有叶子路径及其中文标签 */
export function extractParamPaths(
  modelInfo: Record<string, Record<string, { variables?: Record<string, unknown> }>> | undefined,
  version: string, sysName: string,
): { paths: string[]; labels: Record<string, string> } {
  if (!modelInfo || !sysName) return { paths: [], labels: {} };
  const variables = modelInfo[version || "3X"]?.[sysName]?.variables;
  if (!variables) return { paths: [], labels: {} };
  const paths: string[] = [];
  const labels: Record<string, string> = {};
  function walk(obj: unknown, prefix: string) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
    const rec = obj as Record<string, unknown>;
    const labelMap = (rec._labels ?? {}) as Record<string, string>;
    const entries = Object.entries(rec)
      .filter(([k]) => k !== "_labels" && k !== "_units");
    if (entries.length === 0) {
      if (prefix) paths.push(prefix);
      return;
    }
    const hasNested = entries.some(([, v]) => v && typeof v === "object" && !Array.isArray(v));
    if (!hasNested) {
      // 叶子层：每个属性作为独立路径
      for (const [k] of entries) {
        const full = prefix ? `${prefix}.${k}` : k;
        paths.push(full);
        const l = labelMap[k];
        if (l) labels[full] = l;
      }
      return;
    }
    for (const [k, v] of entries) {
      const childPath = prefix ? `${prefix}.${k}` : k;
      if (labelMap[k]) labels[childPath] = labelMap[k];
      walk(v, childPath);
    }
  }
  walk(variables, "");
  return { paths: [...new Set(paths)].sort(), labels };
}
