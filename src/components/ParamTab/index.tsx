import { useState, useEffect, useRef, useMemo, useCallback, useReducer, forwardRef, useImperativeHandle } from "react";
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

export interface ParamTabHandle {
  /** 提交时以当前参数树为准重建 model_param，杜绝保存时为空 */
  getModelParam: () => string;
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
    // 浅拷贝即可：结果只用于 JSON.stringify，不会就地修改 modelInfo
    if (info.variables) versionFull[sys] = { ...info.variables };
  }
  const accVersion = allVersions[version];
  if (accVersion && typeof accVersion === "object" && !Array.isArray(accVersion)) {
    for (const [sys, entry] of Object.entries(accVersion)) {
      if (versionFull[sys]) Object.assign(versionFull[sys], entry as any);
      else versionFull[sys] = entry as any;
    }
  }
  const sysData = currentVars ?? paramVarsRef.current;
  // Object.assign 不会修改 source，无需深拷贝 sysData
  for (const [sys, vars] of Object.entries(sysData)) {
    if (versionFull[sys]) Object.assign(versionFull[sys], vars as any);
    else versionFull[sys] = vars as any;
  }
  allVersions[version] = versionFull;
  return JSON.stringify(allVersions);
}

function ParamTab({
  systems,
  editDraft,
  setEditDraft,
  modelInfo,
  setActiveTab,
}: Props, ref: React.Ref<ParamTabHandle>) {
  const [paramVars, setParamVars] = useState<Record<string, any>>({});
  const paramVarsRef = useRef(paramVars);
  paramVarsRef.current = paramVars;
  // editDraft 经 ref 暴露给 getModelParam，避免闭包过期
  const editDraftRef = useRef(editDraft);
  editDraftRef.current = editDraft;
  useImperativeHandle(ref, () => ({
    getModelParam: () =>
      buildFullModelParam(editDraftRef.current, modelInfo, paramVarsRef, paramVarsRef.current),
  }), [modelInfo]);
  const dirtyValues = useRef<Map<string, string>>(new Map());
  const [selParamPath, setSelParamPath] = useState("");
  const [paramExpanded, setParamExpanded] = useState<Record<string, boolean>>({});
  const [paramEditGroups, setParamEditGroups] = useState<ParamEditGroup[]>([]);
  const [paramWidth, setParamWidth] = useState(280);

  const paramEntries = useMemo(() => Object.entries(paramVars), [paramVars]);

  // 用例数据是否已加载完成（getCase 返回后 editDraft 才有 id）。
  // 用作门控，避免 modelInfo 先于 getCase 就绪时 ParamTab 抢先 auto-select，
  // 随后被 setEditDraft({...cr.data}) 覆盖掉 model_param。
  const loaded = !!editDraft.id;

  // ── Auto-expand first 3 levels ──
  useEffect(() => {
    if (Object.keys(paramVars).length === 0) return;
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
    setParamExpanded((prev) => ({ ...expandLevels(paramVars, "", 0), ...prev }));
  }, [paramVars]);

  // ── Auto-select / switch system ──
  const prevRef = useRef("");
  useEffect(() => {
    if (!loaded) return;
    if (!editDraft.sys_name && systems.length > 0) {
      onSystemChange(systems[0]);
      prevRef.current = editDraft.sys_name || "";
    } else if (editDraft.sys_name && editDraft.sys_name !== prevRef.current && systems.includes(editDraft.sys_name)) {
      onSystemChange(editDraft.sys_name);
      prevRef.current = editDraft.sys_name || "";
    }
    // 不在分支里设 prevRef：systems 为空时跳过，等下一轮 systems 就绪后 sys_name 仍不等 → 触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systems, editDraft.sys_name, loaded]);

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
    setEditDraft((prev) => ({ ...prev, model_param: buildFullModelParam(prev, modelInfo, paramVarsRef, nv) }));
  }

  // ── selectParamNode ──
  const selectParamNode = useCallback((path: string, activate: boolean) => {
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
  }, [setActiveTab]);

  const onParamSelect = useCallback((path: string) => {
    setParamExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
    selectParamNode(path, true);
  }, [selectParamNode]);

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
  // 输入框 onChange 时 dirtyValues（ref）已更新，只需触发一次重渲读取新值；
  // 不再用 setParamVars({...prev}) —— 那会产生新 paramVars 引用，触发无谓的级联。
  const [, bumpRender] = useReducer((x: number) => x + 1, 0);
  const forceUpdate = bumpRender;

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

export default forwardRef(ParamTab);
