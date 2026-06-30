import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Tabs, message } from "antd";
import {
  getCase,
  updateCase,
  queueModelInfo,
  queueDisturbances,
  getDisturbanceInfo,
} from "../api/index";
import { getCurrentUser } from "../utils/user";
import { isNil } from "../utils/isNil";
import type {
  ModelInfoMap,
  DisturbanceDirNode,
  DisturbanceColumn,
  AddCaseRequest,
} from "../types/api";
import ModelSelectPanel from "./ModelSelectPanel";
import ParamTab from "./ParamTab";
import DisturbTab from "./DisturbTab";
import IndicatorTab from "./IndicatorTab";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

// ── Constants ──
const PRODUCTIVITY_OPTIONS = ["100WPH", "150WPH", "200WPH", "295WPH", "340WPH"];
const VERSION_OPTIONS = ["3X", "5X"];

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

export interface ModelTabHandle {
  /** Flush pending param edits and build the full case body for save/diff. */
  getCaseBody: () => AddCaseRequest;
  /** Persist the current edits; resolves to whether the save succeeded. */
  save: (silent?: boolean) => Promise<boolean>;
}

interface Props {
  caseId: number;
  /** 用例标识字段由父级（内联编辑）维护，保存时合并进 body。 */
  caseName: string;
  caseDescription: string;
  /** 保存成功后通知父级同步用例列表。 */
  onSaved: (body: AddCaseRequest) => void;
}

function ModelTab(
  { caseId, caseName, caseDescription, onSaved }: Props,
  ref: React.Ref<ModelTabHandle>,
) {
  // ── Edit / Model State ──
  const [activeTab, setActiveTab] = useState("model");
  const [editDraft, setEditDraft] = useState<Record<string, any>>({});
  const [modelInfo, setModelInfo] = useState<ModelInfoMap>({});

  // ── Split Pane ──
  const [leftWidth, setLeftWidth] = useState(280);

  // ── Param Tree ──
  const [paramVars, setParamVars] = useState<Record<string, any>>({});
  const paramVarsRef = useRef(paramVars);
  paramVarsRef.current = paramVars;
  const dirtyValues = useRef<Map<string, string>>(new Map()); // "groupPath|rowKey" → current value
  const [selParamPath, setSelParamPath] = useState("");
  const [paramExpanded, setParamExpanded] = useState<Record<string, boolean>>(
    {},
  );
  const [paramEditGroups, setParamEditGroups] = useState<ParamEditGroup[]>([]);

  // ── Disturb Tree ──
  const [disturbTree, setDisturbTree] = useState<DisturbanceDirNode>({});
  const [disturbChecked, setDisturbChecked] = useState<Record<string, boolean>>(
    {},
  );
  const [disturbExpanded, setDisturbExpanded] = useState<
    Record<string, boolean>
  >({});
  const [selDisturbFile, setSelDisturbFile] = useState("");
  const [disturbColumns, setDisturbColumns] = useState<DisturbanceColumn[]>([]);
  const [disturbVisible, setDisturbVisible] = useState<Record<string, boolean>>(
    {},
  );
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInst = useRef<any>(null);

  // ── Derived ──
  const systems = useMemo(() => {
    const version = editDraft.model_verison || "3X";
    return Object.keys(modelInfo[version] || {});
  }, [modelInfo, editDraft.model_verison]);
  const paramEntries = useMemo(() => Object.entries(paramVars), [paramVars]);
  const disturbEntries = useMemo(() => {
    const dirs = disturbTree?.dirs;
    return dirs ? Object.entries(dirs) : [];
  }, [disturbTree]);

  // ── Model Param Builders ──

  /** 构建包含所有版本、所有系统参数的 model_param JSON 字符串。
   *  格式：{ "3X": { sys: nsTree }, "5X": { sys: nsTree } }
   *  仅更新当前版本，其它版本从累积的 editDraft.model_param 中保留。
   *  currentVars 格式：{ sysName: nsTree }
   */
  function buildFullModelParam(currentVars?: Record<string, any>): string {
    const version = editDraft.model_verison || "3X";

    // 保留所有版本（从累积的 editDraft.model_param）
    const allVersions: Record<string, any> = {};
    if (editDraft.model_param) {
      try {
        const saved = JSON.parse(editDraft.model_param);
        if (saved && typeof saved === "object" && !Array.isArray(saved)) {
          Object.assign(allVersions, saved);
        }
      } catch {
        /* */
      }
    }

    // 构建当前版本：默认值 + 该版本已累积值 + 当前系统编辑
    const versionSystems = modelInfo[version] || {};
    const versionFull: Record<string, any> = {};
    for (const [sys, info] of Object.entries(versionSystems)) {
      if (info.variables)
        versionFull[sys] = JSON.parse(JSON.stringify(info.variables));
    }
    const accVersion = allVersions[version];
    if (accVersion && typeof accVersion === "object" && !Array.isArray(accVersion)) {
      Object.assign(versionFull, accVersion);
    }
    const sysData = currentVars ?? paramVarsRef.current;
    if (Object.keys(sysData).length > 0) {
      Object.assign(versionFull, JSON.parse(JSON.stringify(sysData)));
    }
    allVersions[version] = versionFull;
    return JSON.stringify(allVersions);
  }

  /** 从 modelInfo 全量或已保存 model_param 中提取当前系统参数子树。 */
  function extractSystemParams(
    draft: Record<string, any>,
    mi: ModelInfoMap,
  ): Record<string, any> | null {
    const sysName = draft.sys_name;
    const version = draft.model_verison || "3X";
    if (!sysName) return null;
    if (draft.model_param) {
      try {
        const parsed = JSON.parse(draft.model_param);
        const candidate = parsed[version]?.[sysName];
        if (
          candidate &&
          typeof candidate === "object" &&
          !Array.isArray(candidate) &&
          Object.keys(candidate as object).length > 0
        ) {
          return normalizeTypes(candidate) as Record<string, any>;
        }
      } catch {
        /* */
      }
    }
    const versionSystems = mi[version] || {};
    if (
      versionSystems[sysName]?.variables &&
      Object.keys(versionSystems[sysName].variables!).length > 0
    ) {
      return JSON.parse(JSON.stringify(versionSystems[sysName].variables!));
    }
    return null;
  }

  function initParamVars(draft: Record<string, any>, mi: ModelInfoMap) {
    const sysName = draft.sys_name;
    const version = draft.model_verison || "3X";
    let nsTree: Record<string, any> = {};
    const extracted = extractSystemParams(draft, mi);
    if (extracted) {
      nsTree = extracted;
    } else {
      const versionSystems = mi[version] || {};
      if (sysName && versionSystems[sysName]?.variables) {
        nsTree = versionSystems[sysName].variables! as Record<string, any>;
      }
    }
    const newParamVars =
      sysName && Object.keys(nsTree).length > 0 ? { [sysName]: nsTree } : {};
    paramVarsRef.current = newParamVars;
    setParamVars(newParamVars);
  }

  function initParamVarsFilter(draft: Record<string, any>, mi: ModelInfoMap) {
    const sysName = draft.sys_name;
    const version = (draft.model_verison || "3X") as string;

    // 计算当前系统的命名空间树
    let nsTree: Record<string, any> = {};
    const extracted = extractSystemParams(draft, mi);
    if (extracted) {
      nsTree = extracted;
    } else {
      const versionSystems = mi[version] || {};
      if (sysName && versionSystems[sysName]?.variables) {
        nsTree = versionSystems[sysName].variables! as Record<string, any>;
      }
    }

    // paramVars 格式：{ sysName: nsTree }，供参数树顶层显示系统名
    const newParamVars =
      sysName && Object.keys(nsTree).length > 0 ? { [sysName]: nsTree } : {};
    paramVarsRef.current = newParamVars;
    setParamVars(newParamVars);

    // 直接用 draft + mi 重建 model_param（保留所有版本，仅更新当前版本）
    const allVersions: Record<string, any> = {};
    try {
      const saved = JSON.parse(draft.model_param || "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        Object.assign(allVersions, saved);
      }
    } catch {
      /* */
    }
    const versionSystems = mi[version] || {};
    const versionFull: Record<string, any> = {};
    for (const [sys, info] of Object.entries(versionSystems)) {
      if (info.variables)
        versionFull[sys] = JSON.parse(JSON.stringify(info.variables));
    }
    const accVersion = allVersions[version];
    if (accVersion && typeof accVersion === "object" && !Array.isArray(accVersion)) {
      Object.assign(versionFull, accVersion);
    }
    if (sysName && Object.keys(nsTree).length > 0) {
      versionFull[sysName] = nsTree;
    }
    allVersions[version] = versionFull;
    setEditDraft((prev) => ({
      ...prev,
      model_param: JSON.stringify(allVersions),
    }));
  }

  // ── Load case + model info on mount (parent remounts via key={caseId}) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cr = await getCase(caseId);
        if (cancelled || !cr.success || !cr.data) return;
        const draft = { ...cr.data };
        setEditDraft(draft);
        try {
          const mr = await queueModelInfo();
          if (cancelled) return;
          if (mr.success && mr.data) {
            setModelInfo(mr.data);
            initParamVarsFilter(draft, mr.data);
            return;
          }
        } catch {
          /* */
        }
        initParamVars(draft, {});
      } catch {
        /* */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  // 系统列表就绪后，若当前未选系统则默认选中第一个
  useEffect(() => {
    if (!editDraft.sys_name && systems.length > 0) {
      onSystemChange(systems[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systems, editDraft.sys_name]);

  // ── Param Save Helpers ──
  function coerceByType(val: string, orig: unknown) {
    if (val === "" && (orig === null || orig === undefined)) return null;
    const t = typeof orig;
    if (t === "number") {
      const n = Number(val);
      return Number.isNaN(n) ? val : n;
    }
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
      const val = dirtyValues.current.has(dk)
        ? dirtyValues.current.get(dk)!
        : r.value;
      node[r.key] = coerceByType(val, r.orig);
    });
    paramVarsRef.current = nv; // Sync ref so buildFullModelParam sees latest value
    setParamVars(nv);
    setEditDraft((prev) => ({ ...prev, model_param: buildFullModelParam(nv) }));
  }

  // ── Chart ──
  useEffect(() => {
    if (!chartRef.current || disturbColumns.length === 0) {
      if (chartInst.current) {
        chartInst.current.destroy();
        chartInst.current = null;
      }
      return;
    }
    const active = disturbColumns.filter(
      (c) => disturbVisible[c.name] !== false,
    );
    const nonEmpty = active.filter(
      (c) => c.data && c.data.some((v) => !isNil(v)),
    );
    if (nonEmpty.length === 0) {
      if (chartInst.current) {
        chartInst.current.destroy();
        chartInst.current = null;
      }
      return;
    }
    const xData = nonEmpty[0].data.map((_, i) => i);
    const series: Array<object> = [{}];
    nonEmpty.forEach((c, i) =>
      series.push({
        label: c.name,
        stroke: `hsl(${(i * 60) % 360},70%,50%)`,
        width: 1.5,
      }),
    );
    const data = [
      xData,
      ...nonEmpty.map(
        (c) => c.data.map((v) => (isNil(v) ? null : Number(v))) || [],
      ),
    ];
    if (chartInst.current) chartInst.current.destroy();
    try {
      chartInst.current = new (uPlot as any)(
        {
          width: chartRef.current.offsetWidth,
          height: 400,
          cursor: { show: true },
          legend: { show: false },
          scales: { x: { time: false } },
          axes: [{}, { stroke: "#888", grid: { stroke: "#e8e8e8" } }],
          series,
        },
        data,
        chartRef.current,
      );
    } catch {
      /* */
    }
  }, [disturbColumns, disturbVisible]);

  // ── Resize Handler ──
  function startResizeLeft(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const editBody = target.parentElement!;
    const bodyLeft = editBody.getBoundingClientRect().left;
    const bodyW = editBody.offsetWidth;
    document.body.style.userSelect = "none";
    function onMove(ev: MouseEvent) {
      setLeftWidth(Math.min(bodyW * 0.6, Math.max(180, ev.clientX - bodyLeft)));
    }
    function onUp() {
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ── Build full case body (flush pending param edits + merge identity) ──
  function buildBody(): AddCaseRequest {
    for (const g of paramEditGroups) saveParamGroup(g);
    const src: Record<string, any> = {
      ...editDraft,
      model_param: buildFullModelParam(),
    };
    return {
      name: caseName,
      description: caseDescription,
      create_by: src.create_by || getCurrentUser(),
      sys_name: src.sys_name || "",
      model_name: src.model_name || "",
      init_script: src.init_script || "",
      model_verison: src.model_verison || "",
      model_productivity: src.model_productivity || "",
      model_param: src.model_param || "",
      disturbance: src.disturbance || "",
      sim_time: src.sim_time ?? null,
      sim_step: src.sim_step ?? null,
      flow_instance_id: src.flow_instance_id || "",
    };
  }

  // ── Save ──
  async function save(silent = false): Promise<boolean> {
    const body = buildBody();
    try {
      const r = await updateCase(caseId, body);
      if (r.success) {
        onSaved(body);
        if (!silent) message.success("保存成功");
        return true;
      }
      message.error(r.message || "保存失败");
      return false;
    } catch {
      message.error("保存失败");
      return false;
    }
  }

  // ── Imperative handle for parent (Save / Task buttons) ──
  useImperativeHandle(
    ref,
    () => ({ getCaseBody: buildBody, save }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editDraft, modelInfo, paramEditGroups, caseName, caseDescription, onSaved],
  );

  // ── selectParamNode ──
  function selectParamNode(path: string, activate: boolean) {
    setSelParamPath(path);
    if (activate) setActiveTab("param");
    const parts = path.split(".");
    let node: any = paramVarsRef.current;
    for (const p of parts) {
      if (!isObject(node)) {
        node = undefined;
        break;
      }
      node = node[p];
    }
    if (!isObject(node)) {
      setParamEditGroups([]);
      return;
    }
    const labelMap: Record<string, string> = (node as any)._labels || {};
    const unitMap: Record<string, string> = (node as any)._units || {};
    const entries = Object.entries(node).filter(
      ([k]) => k !== "_labels" && k !== "_units" && k !== "ID",
    );
    const hasNested = entries.some(([, v]) => isObject(v));

    function fmt(v: unknown): string {
      if (v === null || v === undefined) return "";
      if (Array.isArray(v)) return JSON.stringify(v);
      return String(v);
    }

    function mkRow(
      k: string,
      v: unknown,
      labels: Record<string, string>,
      units?: Record<string, string>,
    ): ParamRow {
      return {
        key: k,
        label: labels[k] || "",
        unit: (units || {})[k] || "",
        value: fmt(v),
        orig: v,
      };
    }

    if (!hasNested) {
      setParamEditGroups([
        {
          name: parts[parts.length - 1],
          path,
          rows: entries.map(([k, v]) => mkRow(k, v, labelMap, unitMap)),
        },
      ]);
      return;
    }
    if (entries.every(([, v]) => isLastLayer(v))) {
      setParamEditGroups(
        entries.map(([cn, cv]) => ({
          name: cn,
          path: `${path}.${cn}`,
          rows: Object.entries(cv as Record<string, unknown>)
            .filter(([k]) => k !== "_labels" && k !== "_units")
            .map(([k, v]) =>
              mkRow(k, v, (cv as any)._labels || {}, (cv as any)._units || {}),
            ),
        })),
      );
      return;
    }
    // Mixed: some leaf values + some nested nodes — show leaf values as param group
    const leafEntries = entries.filter(([, v]) => !isObject(v));
    setParamEditGroups(
      leafEntries.length > 0
        ? [
            {
              name: parts[parts.length - 1],
              path,
              rows: leafEntries.map(([k, v]) => mkRow(k, v, labelMap, unitMap)),
            },
          ]
        : [],
    );
  }

  function onParamSelect(path: string) {
    selectParamNode(path, true);
  }

  // ── onSystemChange ──
  function onSystemChange(sys: string) {
    // 先把输入框中未提交的编辑（dirtyValues）应用到 paramVarsRef，避免切换时丢失修改
    for (const g of paramEditGroups) saveParamGroup(g);
    const fullModelParam = buildFullModelParam();
    setEditDraft((prev) => ({
      ...prev,
      sys_name: sys,
      model_name: sys,
      init_script: sys,
      model_param: fullModelParam,
    }));
    // 从全量 model_param 或 modelInfo 加载新系统参数
    let nsTree: Record<string, any> | null = null;
    try {
      const full = JSON.parse(fullModelParam);
      const version = editDraft.model_verison || "3X";
      const versionData = full[version] || {};
      if (
        versionData[sys] &&
        typeof versionData[sys] === "object" &&
        !Array.isArray(versionData[sys]) &&
        Object.keys(versionData[sys] as object).length > 0
      ) {
        nsTree = normalizeTypes(versionData[sys]) as Record<string, any>;
      }
    } catch {
      /* */
    }
    if (!nsTree) {
      const version = editDraft.model_verison || "3X";
      const versionSystems = modelInfo[version] || {};
      if (
        versionSystems[sys]?.variables &&
        Object.keys(versionSystems[sys].variables!).length > 0
      ) {
        nsTree = JSON.parse(JSON.stringify(versionSystems[sys].variables!));
      }
    }
    if (nsTree) {
      const newParamVars = { [sys]: nsTree };
      paramVarsRef.current = newParamVars;
      setParamVars(newParamVars);
      // 切换系统后，立即用新系统的首个可编辑节点填充参数详情面板
      const firstPath = findFirstLeafPath(newParamVars);
      if (firstPath) selectParamNode(firstPath, false);
      else {
        setSelParamPath("");
        setParamEditGroups([]);
      }
    } else {
      setSelParamPath("");
      setParamEditGroups([]);
    }
    dirtyValues.current.clear();
  }

  // ── handleDraftChange ──
  const handleDraftChange = useCallback(
    (patch: Record<string, any>) => {
      if (
        "model_verison" in patch &&
        patch.model_verison !== editDraft.model_verison
      ) {
        setEditDraft((prev) => ({
          ...prev,
          ...patch,
          sys_name: "",
          model_name: "",
          init_script: "",
        }));
        paramVarsRef.current = {};
        setParamVars({});
        setSelParamPath("");
        setParamEditGroups([]);
        dirtyValues.current.clear();
      } else {
        setEditDraft((prev) => ({ ...prev, ...patch }));
      }
    },
    [editDraft.model_verison],
  );

  // ── Tab Switch Handler ──
  const handleTabChange = useCallback(
    (key: string) => {
      setActiveTab(key);

      if (key === "model") {
        if (Object.keys(modelInfo).length === 0) {
          (async () => {
            try {
              const r = await queueModelInfo();
              if (r.success && r.data) setModelInfo(r.data);
            } catch {
              /* */
            }
          })();
        }
        if (!editDraft.model_productivity)
          setEditDraft((prev) => ({
            ...prev,
            model_productivity: PRODUCTIVITY_OPTIONS[0],
          }));
        if (!editDraft.model_verison)
          setEditDraft((prev) => ({
            ...prev,
            model_verison: VERSION_OPTIONS[0],
          }));
      }

      if (key === "param") {
        // Auto-expand all param tree nodes
        function expandAllParams(
          node: Record<string, any>,
          path = "",
        ): Record<string, boolean> {
          const keys: Record<string, boolean> = {};
          if (isObject(node)) {
            for (const [k, v] of Object.entries(node)) {
              if (k === "_labels") continue;
              const p = path ? `${path}.${k}` : k;
              keys[p] = true;
              if (isObject(v) && !isLastLayer(v))
                Object.assign(keys, expandAllParams(v, p));
            }
          }
          return keys;
        }
        // Use setTimeout to ensure paramVars is populated from latest state
        setTimeout(() => {
          setParamExpanded(expandAllParams(paramVars));
          // 编辑器为空时自动选中第一个可编辑节点，免去手动点击
          if (
            paramEditGroups.length === 0 &&
            Object.keys(paramVarsRef.current).length > 0
          ) {
            const firstPath = findFirstLeafPath(paramVarsRef.current);
            if (firstPath) selectParamNode(firstPath, false);
          }
        }, 0);
      }

      if (key === "disturb") {
        if (Object.keys(disturbTree).length === 0) {
          (async () => {
            try {
              const r = await queueDisturbances();
              if (r.success && r.data) {
                setDisturbTree(r.data);
                function expandAll(
                  node: DisturbanceDirNode,
                  path = "",
                ): Record<string, boolean> {
                  const keys: Record<string, boolean> = {};
                  const dirs = node.dirs || {};
                  Object.entries(dirs).forEach(([k, v]) => {
                    const p = path ? `${path}/${k}` : k;
                    keys[p] = true;
                    Object.assign(keys, expandAll(v, p));
                  });
                  return keys;
                }
                setDisturbExpanded(expandAll(r.data));
              }
            } catch {
              /* */
            }
          })();
        }
        if (editDraft.disturbance) {
          try {
            const d = JSON.parse(editDraft.disturbance);
            if (d?.length > 0) {
              const ck: Record<string, boolean> = {};
              d.forEach((x: any) => {
                if (x.checked) ck[x.path] = true;
              });
              setDisturbChecked(ck);
            }
          } catch {
            /* */
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modelInfo, editDraft, paramVars, paramEditGroups, disturbTree],
  );

  // ── Disturb Interactions ──
  function onDisturbCheck(fullPath: string) {
    setDisturbChecked((prev) => {
      const next = { ...prev };
      if (next[fullPath]) delete next[fullPath];
      else next[fullPath] = true;
      const dist = Object.entries(next)
        .filter(([, v]) => v)
        .map(([k]) => ({
          path: k,
          name: k.split(/[/\\]/).pop(),
          checked: true,
        }));
      setEditDraft((prev) => ({ ...prev, disturbance: JSON.stringify(dist) }));
      return next;
    });
  }

  async function onDisturbLeafClick(filePath: string) {
    setSelDisturbFile(filePath);
    setActiveTab("disturb");
    setDisturbColumns([]);
    if (chartInst.current) {
      chartInst.current.destroy();
      chartInst.current = null;
    }
    try {
      const r = await getDisturbanceInfo(filePath);
      if (r.success && r.data?.columns) {
        setDisturbColumns(r.data.columns);
        const vis: Record<string, boolean> = {};
        r.data.columns.forEach((c) => {
          vis[c.name] = true;
        });
        setDisturbVisible((prev) => ({ ...prev, ...vis }));
      }
    } catch {
      /* */
    }
  }

  // ── Tab Definitions ──
  const tabItems = [
    {
      key: "model",
      label: "模型选择",
      children: (
        <div className="flex-1 overflow-y-auto overflow-x-hidden box-border px-4 py-3 min-w-0 min-h-0">
          <ModelSelectPanel
            systems={systems}
            draft={editDraft}
            onSysChange={onSystemChange}
            onDraftChange={handleDraftChange}
          />
        </div>
      ),
    },
    {
      key: "param",
      label: "参数配置",
      children: (
        <ParamTab
          leftWidth={leftWidth}
          paramEntries={paramEntries}
          selParamPath={selParamPath}
          paramExpanded={paramExpanded}
          onToggle={(p) =>
            setParamExpanded((prev) => ({ ...prev, [p]: !prev[p] }))
          }
          onSelect={onParamSelect}
          paramEditGroups={paramEditGroups}
          dirtyValues={dirtyValues}
          onSave={saveParamGroup}
          onForceUpdate={() => setParamVars((prev) => ({ ...prev }))}
          startResizeLeft={startResizeLeft}
        />
      ),
    },
    {
      key: "disturb",
      label: "扰动选择",
      children: (
        <DisturbTab
          leftWidth={leftWidth}
          disturbEntries={disturbEntries}
          disturbChecked={disturbChecked}
          disturbExpanded={disturbExpanded}
          selDisturbFile={selDisturbFile}
          onToggle={(p) =>
            setDisturbExpanded((prev) => ({ ...prev, [p]: !prev[p] }))
          }
          onCheck={onDisturbCheck}
          onLeafClick={onDisturbLeafClick}
          disturbTree={disturbTree}
          disturbColumns={disturbColumns}
          disturbVisible={disturbVisible}
          onToggleVisible={(name) =>
            setDisturbVisible((prev) => ({ ...prev, [name]: !prev[name] }))
          }
          chartRef={chartRef}
          startResizeLeft={startResizeLeft}
        />
      ),
    },
    {
      key: "indicator",
      label: "参数扫描",
      children: <IndicatorTab />,
    },
  ];

  return (
    <Tabs
      className="edit-tabs"
      activeKey={activeTab}
      onChange={handleTabChange}
      items={tabItems}
    />
  );
}

export default forwardRef(ModelTab);
