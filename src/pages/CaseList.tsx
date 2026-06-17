import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Button, Input, Modal, Table, Tabs, message } from "antd";
import {
  queueCases,
  addCase,
  updateCase,
  queueModelInfo,
  queueDisturbances,
  getDisturbanceInfo,
  shareCase,
  unshareCase,
  getCaseShares,
  diffCase,
  addTasks,
  runTasks,
} from "../api/index";
import { getCurrentUser } from "../utils/user";
import type {
  CaseModel,
  ModelInfoMap,
  DisturbanceDirNode,
  DisturbanceColumn,
  AddCaseRequest,
} from "../types/api";
import CaseSidebar from "../components/CaseSidebar";
import CaseDetail from "../components/CaseDetail";
import ModelTab from "../components/ModelTab";
import ParamTab from "../components/ParamTab";
import DisturbTab from "../components/DisturbTab";
import IndicatorTab from "../components/IndicatorTab";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { isNil } from "../utils/isNil";
import "./CaseList.css";

// ── Constants ──
const PRODUCTIVITY_OPTIONS = ["100WPH", "150WPH"];
const VERSION_OPTIONS = ["3X", "5X"];
function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function isLastLayer(v: unknown): boolean {
  if (!isObject(v)) return false;
  return Object.entries(v)
    .filter(([k]) => k !== "_labels" && k !== "_units")
    .every(([, cv]) => !isObject(cv));
}
/** 深度优先查找第一个 isLastLayer（含可编辑叶子值）的命名空间路径。 */
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

type ParamRow = {
  key: string;
  label: string;
  unit: string;
  value: string;
  orig: unknown;
};
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

// ── Main Component ──
export default function CaseList() {
  // ── Case List State ──
  const [cases, setCases] = useState<CaseModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Edit State ──
  const [editCase, setEditCase] = useState<CaseModel | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [modelInfo, setModelInfo] = useState<ModelInfoMap>({});
  const [activeTab, setActiveTab] = useState("model");

  // ── Split Pane ──
  const [leftWidth, setLeftWidth] = useState(280);
  const [editingCell, setEditingCell] = useState<{
    id: number | null;
    field: string;
  }>({ id: null, field: "" });
  const [editValue, setEditValue] = useState("");

  // ── Delete ──
  const [deleteTarget, setDeleteTarget] = useState<CaseModel | null>(null);

  // ── Share ──
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCaseId, setShareCaseId] = useState<number | null>(null);
  const [shareUsers, setShareUsers] = useState<string[]>([]);
  const [shareNewUser, setShareNewUser] = useState("");

  // ── Task / Diff ──
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [diffRows, setDiffRows] = useState<
    Array<{ path: string; old: string; new: string }>
  >([]);
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  // ── Param Tree ──
  const [paramVars, setParamVars] = useState<Record<string, any>>({});
  const paramVarsRef = useRef(paramVars);


  paramVarsRef.current = paramVars;
  const dirtyValues = useRef<Map<string, string>>(new Map()); // "groupPath|rowKey" → current value
  const [selParamPath, setSelParamPath] = useState("");
  const [paramExpanded, setParamExpanded] = useState<Record<string, boolean>>(
    {},
  );
  const [paramEditGroups, setParamEditGroups] = useState<
    Array<{
      name: string;
      path: string;
      rows: ParamRow[];
    }>
  >([]);

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

  const systems = useMemo(() => {
    const version = editDraft.model_verison || "3X";
    return Object.keys(modelInfo[version] || {});
  }, [modelInfo, editDraft.model_verison]);
  const paramEntries = useMemo(() => Object.entries(paramVars), [paramVars]);
  const disturbEntries = useMemo(() => {
    const dirs = disturbTree?.dirs;
    return dirs ? Object.entries(dirs) : [];
  }, [disturbTree]);

  // ── Load Cases ──
  const loadCases = useCallback(async () => {
    try {
      const r = await queueCases();
      if (r.success && r.data) setCases(r.data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadCases().finally(() => setLoading(false));
  }, [loadCases]);

  // ── Helpers ──
  function buildCaseBody(src: Record<string, any>): AddCaseRequest {
    return {
      name: src.name || "",
      description: src.description || "",
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
    };
  }

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
    const versionSystems = modelInfo[version] || {};
    if (
      versionSystems[sysName]?.variables &&
      Object.keys(versionSystems[sysName].variables!).length > 0
    ) {
      return JSON.parse(JSON.stringify(versionSystems[sysName].variables!));
    }
    return null;
  }

  function initParamVars(draft: Record<string, any>) {
    const sysName = draft.sys_name;
    const version = draft.model_verison || "3X";
    let nsTree: Record<string, any> = {};
    const extracted = extractSystemParams(draft);
    if (extracted) {
      nsTree = extracted;
    } else {
      const versionSystems = modelInfo[version] || {};
      if (sysName && versionSystems[sysName]?.variables) {
        nsTree = versionSystems[sysName].variables! as Record<string, any>;
      }
    }
    const newParamVars = sysName && Object.keys(nsTree).length > 0
      ? { [sysName]: nsTree }
      : {};
    paramVarsRef.current = newParamVars;
    setParamVars(newParamVars);
  }

  // ── Open Edit ──
  async function openEdit(c: CaseModel) {
    setEditCase(c);
    const draft = { ...c };
    setEditDraft(draft);
    setActiveTab("model");
    setParamVars({});
    dirtyValues.current.clear();
    setSelParamPath("");
    setParamExpanded({});
    setParamEditGroups([]);
    setDisturbTree({});
    setDisturbChecked({});
    setDisturbExpanded({});
    setSelDisturbFile("");
    setDisturbColumns([]);
    if (chartInst.current) {
      chartInst.current.destroy();
      chartInst.current = null;
    }

    try {
      const r = await queueModelInfo();
      if (r.success && r.data) {
        setModelInfo(r.data);
        initParamVarsFilter(draft, r.data);
        return;
      }
    } catch {
      /* */
    }
    initParamVars(draft);
  }

  function initParamVarsFilter(draft: Record<string, any>, mi: ModelInfoMap) {
    const sysName = draft.sys_name;
    const version = (draft.model_verison || "3X") as string;

    // 计算当前系统的命名空间树
    let nsTree: Record<string, any> = {};
    const extracted = extractSystemParams(draft);
    if (extracted) {
      nsTree = extracted;
    } else {
      const versionSystems = mi[version] || {};
      if (sysName && versionSystems[sysName]?.variables) {
        nsTree = versionSystems[sysName].variables! as Record<string, any>;
      }
    }

    // paramVars 格式：{ sysName: nsTree }，供参数树顶层显示系统名
    const newParamVars = sysName && Object.keys(nsTree).length > 0
      ? { [sysName]: nsTree }
      : {};
    paramVarsRef.current = newParamVars;
    setParamVars(newParamVars);

    // 直接用 draft + mi 重建 model_param（保留所有版本，仅更新当前版本）
    const allVersions: Record<string, any> = {};
    try {
      const saved = JSON.parse(draft.model_param || "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        Object.assign(allVersions, saved);
      }
    } catch { /* */ }
    const versionSystems = mi[version] || {};
    const versionFull: Record<string, any> = {};
    for (const [sys, info] of Object.entries(versionSystems)) {
      if (info.variables) versionFull[sys] = JSON.parse(JSON.stringify(info.variables));
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

  // ── Save ──
  async function handleSave(silent = false) {
    if (!editCase) return;
    // Flush pending param edits before building body
    for (const g of paramEditGroups) saveParamGroup(g);
    setSaving(true);
    try {
      const body = buildCaseBody({
        ...editCase,
        ...editDraft,
        model_param: buildFullModelParam(),
      });
      const r = await updateCase(editCase.id!, body);
      if (r.success) {
        // 用 body.model_param（已正确构建）覆盖，避免 editDraft.model_param 因异步 setState 滞后
        Object.assign(editCase, editDraft, { model_param: body.model_param });
        setCases((prev) =>
          prev.map((c) => (c.id === editCase.id ? { ...editCase } : c)),
        );
        if (!silent) message.success("保存成功");
      } else {
        message.error(r.message || "保存失败");
      }
    } catch {
      message.error("保存失败");
    } finally {
      setSaving(false);
    }
  }

  // ── Inline Edit ──
  function startInline(c: CaseModel, field: string) {
    setEditingCell({ id: c.id!, field });
    setEditValue((c as any)[field] || "");
  }
  function cancelInline() {
    setEditingCell({ id: null, field: "" });
  }

  async function saveInline(c: CaseModel, field: string) {
    const val = editValue;
    cancelInline();
    if (val === ((c as any)[field] || "")) return;
    const body = buildCaseBody(c);
    (body as any)[field] = val;
    const r = await updateCase(c.id!, body);
    if (r.success) {
      (c as any)[field] = val;
      setEditDraft((prev) => ({ ...prev, [field]: val }));
      setCases((prev) => [...prev]);
    }
  }

  // ── Add Case ──
  async function handleAdd() {
    if (!addName.trim()) return;
    setSubmitting(true);
    try {
      const r = await addCase({
        name: addName.trim(),
        description: addDesc.trim(),
        create_by: getCurrentUser(),
        sys_name: "",
        model_name: "",
        init_script: "",
        model_verison: "3X",
        model_productivity: "100WPH",
        model_param: "",
        disturbance: "",
      });
      if (r.success) {
        const newId = r.data!.id;
        setAddName("");
        setAddDesc("");
        setAddModalOpen(false);
        const fresh = await queueCases();
        if (fresh.success && fresh.data) {
          setCases(fresh.data);
          const found = fresh.data.find((c) => c.id === newId);
          if (found) openEdit(found);
        }
      }
    } catch {
      message.error("添加失败");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Copy ──
  async function handleCopy(c: CaseModel) {
    try {
      const r = await addCase({
        ...buildCaseBody(c),
        name: c.name + "_copy",
        create_by: getCurrentUser(),
      });
      if (r.success) await loadCases();
    } catch {
      message.error("复制失败");
    }
  }

  // ── Delete ──
  const [deleting, setDeleting] = useState(false);

  function confirmDelete(c: CaseModel) {
    setDeleteTarget(c);
  }
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const body: any = { ...buildCaseBody(deleteTarget), is_deleted: true };
      const r = await updateCase(deleteTarget.id!, body);
      if (r.success) {
        setDeleteTarget(null);
        if (editCase?.id === deleteTarget.id) setEditCase(null);
        await loadCases();
        message.success("删除成功");
      }
    } catch {
      message.error("删除失败");
    } finally {
      setDeleting(false);
    }
  }

  // ── Share ──
  async function openShare(c: CaseModel) {
    setShareCaseId(c.id!);
    setShareOpen(true);
    try {
      const r = await getCaseShares(c.id!);
      if (r.success && r.data)
        setShareUsers(r.data.map((s: any) => s.shared_to_user));
    } catch {
      /* */
    }
  }
  async function handleShare() {
    if (!shareNewUser.trim() || !shareCaseId) return;
    const r = await shareCase(shareCaseId, shareNewUser.trim());
    if (r.success) {
      setShareUsers((prev) => [...prev, shareNewUser.trim()]);
      setShareNewUser("");
    }
  }
  async function handleUnshare(user: string) {
    if (!shareCaseId) return;
    const r = await unshareCase(shareCaseId, user);
    if (r.success) setShareUsers((prev) => prev.filter((u) => u !== user));
  }

  // ── Left Panel Section Activation ──
  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);

    if (key === "model") {
      if (Object.keys(modelInfo).length === 0) {
        queueModelInfo().then((r) => {
          if (r.success && r.data) setModelInfo(r.data);
        }).catch(() => {});
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
        queueDisturbances().then((r) => {
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
        }).catch(() => {});
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
  }, [modelInfo, editDraft, paramVars, paramEditGroups, disturbTree, paramVarsRef]);

  // ── Param Tree Interactions ──
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

  const handleDraftChange = useCallback(
    (patch: Record<string, any>) => {
      if ("model_verison" in patch && patch.model_verison !== editDraft.model_verison) {
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

  /** 根据路径从 paramVarsRef 构建参数编辑分组，填充 paramEditGroups。
   *  activate=true 时同时切换到 param 区段（用于树节点点击）。 */
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

  function saveParamGroup(group: {
    name: string;
    path: string;
    rows: ParamRow[];
  }) {
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

  // ── Task ──
  async function openTaskModal() {
    await handleSave(true);
    if (!editCase) return;
    const body = buildCaseBody({
      ...editCase,
      ...editDraft,
      model_param: buildFullModelParam(),
    });
    try {
      const r = await diffCase(editCase.id!, body);
      if (r.success && r.data) {
        const diffDict = r.data as unknown as Record<
          string,
          Record<string, { old_value?: unknown; new_value?: unknown }>
        >;
        function cleanPath(raw: string): string {
          return raw
            .replace(/^root/, "")
            .replace(/\['([^']*)'\]/g, ".$1")
            .replace(/\["([^"]*)"\]/g, ".$1")
            .replace(/^\./, "");
        }
        const rows: Array<{ path: string; old: string; new: string }> = [];
        const fmt = (v: unknown): string =>
          isNil(v)
            ? ""
            : typeof v === "object"
              ? JSON.stringify(v)
              : String(v);
        for (const [changeType, items] of Object.entries(diffDict)) {
          if (!items || typeof items !== "object") continue;
          const prefix = changeType.includes("added")
            ? "+ "
            : changeType.includes("removed")
              ? "- "
              : "";
          for (const [path, v] of Object.entries(items)) {
            rows.push({
              path: prefix + cleanPath(path),
              old: fmt(v.old_value),
              new: fmt(v.new_value),
            });
          }
        }
        setDiffRows(rows);
      }
    } catch {
      message.error("获取差异失败");
    }
    setTaskModalOpen(true);
  }

  async function handleRunTask() {
    setTaskSubmitting(true);
    try {
      await handleSave(true);
      if (!editCase) return;
      const r = await addTasks(editCase.id!);
      if (!r.success) return;
      const taskIds = r.data!.task_ids;
      const runR = await runTasks(taskIds);
      if (runR.success) {
        message.success(`任务已提交 (ID: ${taskIds.join(",")})`);
        setTaskModalOpen(false);
      }
    } catch {
      message.error("任务提交失败");
    } finally {
      setTaskSubmitting(false);
    }
  }

  // ── Resize Handlers ──
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

  // ── Render ──
  const tabItems = [
    {
      key: "model",
      label: "模型选择",
      children: (
        <ModelTab
          systems={systems}
          draft={editDraft}
          onSysChange={onSystemChange}
          onDraftChange={handleDraftChange}
        />
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
      label: "扰动分析",
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
      label: "指标分析",
      children: <IndicatorTab />,
    },
  ];

  return (
    <div className="case-page">
      <div className="case-layout">
        <CaseSidebar
          cases={cases}
          loading={loading}
          editCase={editCase}
          onSelect={openEdit}
          onAdd={() => setAddModalOpen(true)}
        />

        {/* Main Content */}
        <div className="case-main">
          <div className="split-container">
            <CaseDetail
              editCase={editCase}
              editingCell={editingCell}
              editValue={editValue}
              onStartEdit={startInline}
              onSaveEdit={saveInline}
              onCancelEdit={cancelInline}
              onValueChange={setEditValue}
              onCopy={handleCopy}
              onShare={openShare}
              onDelete={confirmDelete}
            />

            {editCase && (
              <div className="edit-panel">
                <div className="edit-toolbar">
                  <div className="toolbar-actions">
                    <Button
                      className="btn-outline"
                      size="small"
                      onClick={openTaskModal}
                    >
                      创建任务
                    </Button>
                    <Button
                      className="btn-outline"
                      size="small"
                      loading={saving}
                      onClick={() => handleSave()}
                    >
                      保存
                    </Button>
                  </div>
                </div>
                <Tabs
                  className="edit-tabs"
                  activeKey={activeTab}
                  onChange={handleTabChange}
                  items={tabItems}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        title="创建用例"
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setAddModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="confirm"
            type="primary"
            loading={submitting}
            onClick={handleAdd}
          >
            添加
          </Button>,
        ]}
      >
        <div className="form-group">
          <label className="form-label">用例名称</label>
          <Input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="输入用例名称"
          />
        </div>
        <div className="form-group">
          <label className="form-label">用例描述</label>
          <Input.TextArea
            value={addDesc}
            onChange={(e) => setAddDesc(e.target.value)}
            rows={3}
            placeholder="输入用例描述"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      </Modal>

      {/* Share Modal */}
      <Modal
        title="共享用例"
        open={shareOpen}
        onCancel={() => setShareOpen(false)}
        footer={null}
      >
        <div className="share-subtitle">已共享用户</div>
        {shareUsers.length > 0 ? (
          <div className="share-list">
            {shareUsers.map((u) => (
              <div className="share-user-row" key={u}>
                <span>{u}</span>
                <Button size="small" danger onClick={() => handleUnshare(u)}>
                  移除
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="share-empty">暂无共享用户</div>
        )}
        <div className="share-add-row">
          <Input
            value={shareNewUser}
            onChange={(e) => setShareNewUser(e.target.value)}
            placeholder="输入用户名"
            style={{ flex: 1 }}
          />
          <Button type="primary" onClick={handleShare}>
            添加
          </Button>
        </div>
      </Modal>

      {/* Task Modal */}
      <Modal
        title="创建仿真任务"
        open={taskModalOpen}
        onCancel={() => setTaskModalOpen(false)}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setTaskModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="run"
            type="primary"
            loading={taskSubmitting}
            onClick={handleRunTask}
          >
            运行
          </Button>,
        ]}
      >
        <div className="diff-section-title">参数变更预览</div>
        {diffRows.length > 0 ? (
          <Table
            size="small"
            pagination={false}
            dataSource={diffRows.map((r, i) => ({ ...r, _key: i }))}
            rowKey="_key"
            columns={[
              { title: "参数路径", dataIndex: "path", className: "diff-path" },
              { title: "原值", dataIndex: "old", className: "diff-old" },
              { title: "新值", dataIndex: "new", className: "diff-new" },
            ]}
          />
        ) : (
          <div className="diff-empty">无变更</div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal
        title="确认删除"
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        footer={[
          <Button key="cancel" onClick={() => setDeleteTarget(null)}>
            取消
          </Button>,
          <Button
            key="confirm"
            danger
            type="primary"
            loading={deleting}
            onClick={handleDelete}
          >
            确认
          </Button>,
        ]}
      >
        <p>
          确定要删除用例 <b>{deleteTarget?.name}</b> 吗？
        </p>
        <p className="delete-hint">此操作不可撤销</p>
      </Modal>
    </div>
  );
};



