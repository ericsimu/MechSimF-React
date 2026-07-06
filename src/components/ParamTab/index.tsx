import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import TreeNode from '@/components/TreeNode';
import ParamEditor from '@/components/ParamEditor';
import type { ModelInfoMap } from '@/types/api';

// ── Helpers ──
function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function isLastLayer(v: unknown): boolean {
  if (!isObject(v)) return false;
  return Object.entries(v)
    .filter(([k]) => k !== "_labels" && k !== "_units")
    .every(([, cv]) => !isObject(cv));
}
function findFirstLeafPath(node: unknown, path = ""): string | null {
  if (!isObject(node)) return null;
  const entries = Object.entries(node).filter(
    ([k]) => k !== "_labels" && k !== "_units" && k !== "ID",
  );
  for (const [k, v] of entries) {
    const p = path ? `${path}.${k}` : k;
    if (isLastLayer(v)) return p;
    if (isObject(v)) {
      const found = findFirstLeafPath(v, p);
      if (found) return found;
    }
  }
  return null;
}
function normalizeTypes(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(normalizeTypes);
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = normalizeTypes(v);
    return out;
  }
  if (typeof obj === "string") {
    if (obj === "") return null;
    if (obj === "true" || obj === "True") return true;
    if (obj === "false" || obj === "False") return false;
    if (obj === "null" || obj === "None") return null;
    const n = Number(obj);
    if (!Number.isNaN(n) && obj.trim() !== "") return n;
  }
  return obj;
}

// ── Types ──
type ParamRow = {
  key: string;
  label: string;
  unit: string;
  value: string;
  orig: unknown;
};
interface ParamEditGroup {
  name: string;
  path: string;
  rows: ParamRow[];
}

interface Props {
  systems: string[];
  editDraft: Record<string, any>;
  setEditDraft: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  modelInfo: ModelInfoMap;
  setActiveTab: (key: string) => void;
}

export function buildFullModelParam(
  editDraft: Record<string, any>,
  modelInfo: ModelInfoMap,
  paramVarsRef: React.MutableRefObject<Record<string, any>>,
  currentVars?: Record<string, any>,
): string {
  const version = editDraft.model_verison || "3X";
  const allVersions: Record<string, any> = {};
  if (editDraft.model_param) {
    try {
      const saved = JSON.parse(editDraft.model_param);
      if (saved && typeof saved === "object" && !Array.isArray(saved))
        Object.assign(allVersions, saved);
    } catch { /* */ }
  }
  const versionSystems = modelInfo[version] || {};
  const versionFull: Record<string, any> = {};
  for (const [sys, info] of Object.entries(versionSystems)) {
    if (info.variables) versionFull[sys] = JSON.parse(JSON.stringify(info.variables));
  }
  const accVersion = allVersions[version];
  if (accVersion && typeof accVersion === "object" && !Array.isArray(accVersion)) {
    // 逐系统合并，保留 modelInfo 变量
    for (const [sys, entry] of Object.entries(accVersion)) {
      if (versionFull[sys]) Object.assign(versionFull[sys], entry);
      else versionFull[sys] = entry;
    }
  }
  const sysData = currentVars ?? paramVarsRef.current;
  if (Object.keys(sysData).length > 0) {
    // 逐系统合并，只覆盖变量键，不动 DisturbanceFiles
    for (const [sys, vars] of Object.entries(JSON.parse(JSON.stringify(sysData)))) {
      if (versionFull[sys]) Object.assign(versionFull[sys], vars as any);
      else versionFull[sys] = vars as any;
    }
  }
  allVersions[version] = versionFull;
  return JSON.stringify(allVersions);
}

export default function ParamTab({
  systems,
  editDraft,
  setEditDraft,
  modelInfo,
  setActiveTab,
}: Props) {
  const [paramVars, setParamVars] = useState<Record<string, any>>({});
  const paramVarsRef = useRef(paramVars);
  paramVarsRef.current = paramVars;
  const dirtyValues = useRef<Map<string, string>>(new Map());
  const [selParamPath, setSelParamPath] = useState("");
  const [paramExpanded, setParamExpanded] = useState<Record<string, boolean>>({});
  const [paramEditGroups, setParamEditGroups] = useState<ParamEditGroup[]>([]);
  const [paramWidth, setParamWidth] = useState(280);

  const paramEntries = useMemo(() => Object.entries(paramVars), [paramVars]);

  // ── Init param tree from saved model_param + modelInfo ──
  const initializedRef = useRef(false);
  useEffect(() => {
    if (Object.keys(modelInfo).length > 0 && editDraft.sys_name && !initializedRef.current) {
      initializedRef.current = true;
      const draft = editDraft;
      const mi = modelInfo;
      const sysName = draft.sys_name;
      const version = (draft.model_verison || "3X") as string;
      let nsTree: Record<string, any> = {};
      const parsed = (() => {
        if (!draft.model_param) return null;
        try {
          const p = JSON.parse(draft.model_param);
          const c = p[version]?.[sysName];
          if (c && typeof c === "object" && !Array.isArray(c) && Object.keys(c as object).length > 0)
            return normalizeTypes(c) as Record<string, any>;
        } catch { /* */ }
        return null;
      })();
      if (parsed) nsTree = parsed;
      else {
        const vs = mi[version] || {};
        if (sysName && vs[sysName]?.variables) nsTree = vs[sysName].variables! as Record<string, any>;
      }
      const newParamVars = sysName && Object.keys(nsTree).length > 0 ? { [sysName]: nsTree } : {};
      paramVarsRef.current = newParamVars;
      setParamVars(newParamVars);
    }
  }, [modelInfo, editDraft]);

  // ── Auto-expand first 3 levels ──
  const paramInitExpandedRef = useRef(false);
  useEffect(() => {
    if (paramInitExpandedRef.current || Object.keys(paramVars).length === 0) return;
    paramInitExpandedRef.current = true;
    function expandLevels(node: unknown, path: string, depth: number): Record<string, boolean> {
      const keys: Record<string, boolean> = {};
      if (depth >= 3 || !isObject(node)) return keys;
      const entries = Object.entries(node as Record<string, unknown>).filter(([k]) => k !== "_labels" && k !== "_units" && k !== "ID");
      for (const [k, v] of entries) {
        const p = path ? `${path}.${k}` : k;
        keys[p] = true;
        if (isObject(v)) Object.assign(keys, expandLevels(v, p, depth + 1));
      }
      return keys;
    }
    setParamExpanded(expandLevels(paramVars, "", 0));
  }, [paramVars]);

  // ── Auto-select system ──
  useEffect(() => {
    if (!editDraft.sys_name && systems.length > 0) {
      onSystemChange(systems[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systems, editDraft.sys_name]);

  // ── Helpers ──
  function coerceByType(val: string, orig: unknown) {
    if (val === "" && (orig === null || orig === undefined)) return null;
    const t = typeof orig;
    if (t === "number") { const n = Number(val); return Number.isNaN(n) ? val : n; }
    if (t === "boolean") return val === "true" || val === "1";
    return val;
  }

  function saveParamGroup(group: ParamEditGroup) {
    const parts = group.path.split(".");
    const nv = JSON.parse(JSON.stringify(paramVarsRef.current));
    let node = nv;
    for (const p of parts) node = node[p];
    group.rows.forEach((r) => {
      const dk = `${group.path}|${r.key}`;
      const val = dirtyValues.current.has(dk) ? dirtyValues.current.get(dk)! : r.value;
      node[r.key] = coerceByType(val, r.orig);
    });
    paramVarsRef.current = nv;
    setParamVars(nv);
    setEditDraft((prev) => ({ ...prev, model_param: buildFullModelParam(editDraft, modelInfo, paramVarsRef, nv) }));
  }

  // ── selectParamNode ──
  function selectParamNode(path: string, activate: boolean) {
    setSelParamPath(path);
    if (activate) setActiveTab("param");
    const parts = path.split(".");
    let node: any = paramVarsRef.current;
    for (const p of parts) { if (!isObject(node)) { node = undefined; break; } node = node[p]; }
    if (!isObject(node)) { setParamEditGroups([]); return; }
    const labelMap: Record<string, string> = (node as any)._labels || {};
    const unitMap: Record<string, string> = (node as any)._units || {};
    const entries = Object.entries(node).filter(([k]) => k !== "_labels" && k !== "_units" && k !== "ID");
    const hasNested = entries.some(([, v]) => isObject(v));

    function fmt(v: unknown): string {
      if (v === null || v === undefined) return "";
      if (Array.isArray(v)) return JSON.stringify(v);
      return String(v);
    }
    function mkRow(k: string, v: unknown, labels: Record<string, string>, units?: Record<string, string>): ParamRow {
      return { key: k, label: labels[k] || "", unit: (units || {})[k] || "", value: fmt(v), orig: v };
    }

    if (!hasNested) {
      setParamEditGroups([{ name: parts[parts.length - 1], path, rows: entries.map(([k, v]) => mkRow(k, v, labelMap, unitMap)) }]);
      return;
    }
    if (entries.every(([, v]) => isLastLayer(v))) {
      setParamEditGroups(entries.map(([cn, cv]) => ({
        name: cn, path: `${path}.${cn}`,
        rows: Object.entries(cv as Record<string, unknown>)
          .filter(([k]) => k !== "_labels" && k !== "_units")
          .map(([k, v]) => mkRow(k, v, (cv as any)._labels || {}, (cv as any)._units || {})),
      })));
      return;
    }
    const leafEntries = entries.filter(([, v]) => !isObject(v));
    setParamEditGroups(leafEntries.length > 0
      ? [{ name: parts[parts.length - 1], path, rows: leafEntries.map(([k, v]) => mkRow(k, v, labelMap, unitMap)) }]
      : [],
    );
  }

  function onParamSelect(path: string) {
    setParamExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
    selectParamNode(path, true);
  }

  // ── onSystemChange ──
  function onSystemChange(sys: string) {
    for (const g of paramEditGroups) saveParamGroup(g);
    const fullMP = buildFullModelParam(editDraft, modelInfo, paramVarsRef);
    setEditDraft((prev) => ({ ...prev, sys_name: sys, model_name: sys, init_script: sys, model_param: fullMP }));
    const version = editDraft.model_verison || "3X";
    let nsTree: Record<string, any> | null = null;
    try {
      const full = JSON.parse(fullMP);
      const vd = full[version] || {};
      if (vd[sys] && typeof vd[sys] === "object" && !Array.isArray(vd[sys]) && Object.keys(vd[sys] as object).length > 0)
        nsTree = normalizeTypes(vd[sys]) as Record<string, any>;
    } catch { /* */ }
    if (!nsTree) {
      const vs = modelInfo[version] || {};
      if (vs[sys]?.variables && Object.keys(vs[sys].variables!).length > 0)
        nsTree = JSON.parse(JSON.stringify(vs[sys].variables!));
    }
    if (nsTree) {
      const newPV = { [sys]: nsTree };
      paramVarsRef.current = newPV;
      setParamVars(newPV);
      const fp = findFirstLeafPath(newPV);
      if (fp) selectParamNode(fp, false);
      else { setSelParamPath(""); setParamEditGroups([]); }
    } else { setSelParamPath(""); setParamEditGroups([]); }
    dirtyValues.current.clear();
  }

  const handleToggle = useCallback((p: string) => setParamExpanded(prev => ({ ...prev, [p]: !prev[p] })), []);
  const forceUpdate = useCallback(() => setParamVars(prev => ({ ...prev })), []);

  // ── Resize ──
  function startResize(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const editBody = target.parentElement!;
    const bodyLeft = editBody.getBoundingClientRect().left;
    const bodyW = editBody.offsetWidth;
    document.body.style.userSelect = "none";
    function onMove(ev: MouseEvent) { setParamWidth(Math.min(bodyW * 0.6, Math.max(180, ev.clientX - bodyLeft))); }
    function onUp() { document.body.style.userSelect = ""; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <div className="flex-1 flex overflow-hidden min-h-0">
      <div className="shrink-0 overflow-y-auto overflow-x-hidden box-border border-r border-[#f0f0f0] bg-[#fafafa] pb-3 min-h-0" style={{ width: paramWidth }}>
        {paramEntries.map(([k, v]) => (
          <TreeNode key={k} name={k} value={v} path={k} selPath={selParamPath} expanded={paramExpanded}
            onToggle={handleToggle}
            onSelect={onParamSelect}
          />
        ))}
        {paramEntries.length === 0 && <div className="px-4 py-2 text-[#999] text-xs">暂无参数数据</div>}
      </div>
      <div className="w-1 bg-[#f0f0f0] cursor-col-resize shrink-0 border-l border-r border-[#f0f0f0] transition-colors hover:bg-[#d9d9d9]" onMouseDown={startResize} />
      <div className="flex-1 overflow-y-auto overflow-x-hidden box-border px-4 py-3 min-w-0 min-h-0">
        {paramEditGroups.length > 0 && (
          <ParamEditor groups={paramEditGroups} dirtyValues={dirtyValues} onSave={saveParamGroup}
            forceUpdate={forceUpdate}
          />
        )}
      </div>
    </div>
  );
}
