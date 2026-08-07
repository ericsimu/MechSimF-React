import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Button, Dropdown, message, Modal, List, Switch, Menu } from "antd";
import type { MenuProps } from "antd";
import { PlusOutlined, FileExcelOutlined, TableOutlined } from "@ant-design/icons";
import { addSweep, updateSweep, deleteSweep as apiDeleteSweep, batchSweeps, sweepsByCase, sweepsByUser, linkSweepToCase, unlinkSweepFromCase, updateSharding, fetchSweepTemplates, fetchSweepTemplate } from "@/api/index";
import { getCurrentUser } from "@/utils/user";
import type { SweepItem, EditTarget, SweepOps } from "./types";
import { defaultRow, coerceValue, extractParamPaths, FIXED_KEYS } from "./utils";
import { SweepTable } from "./SweepTable";

interface SweepTabProps {
  caseId: number;
  modelInfo?: Record<string, Record<string, { variables?: Record<string, unknown> }>>;
  modelVersion?: string;
  sysName?: string;
  enableSharding?: boolean;
}

export default function SweepTab({ caseId, modelInfo, modelVersion = "", sysName = "", enableSharding = false }: SweepTabProps) {
  const [data, setData] = useState<SweepItem[]>([]);
  const [visibleIds, setVisibleIds] = useState<number[]>([]);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [allUserSweeps, setAllUserSweeps] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInitValue, setShowInitValue] = useState(enableSharding);
  const handleToggleSharding = useCallback(async (v: boolean) => {
    setShowInitValue(v);
    try { await updateSharding(caseId, v); } catch { /* */ }
  }, [caseId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await sweepsByCase(caseId);
        if (cancelled || !res.data) return;
        const items: SweepItem[] = res.data.map((m) => ({
          id: m.id!, name: m.name,
          groups: (() => { try { return JSON.parse(m.body); } catch { return []; } })(),
        }));
        setData(items); setVisibleIds(items.map((s) => s.id));
      } catch { /* */ }
      try {
        const userRes = await sweepsByUser(getCurrentUser());
        if (!cancelled && userRes.data) setAllUserSweeps(userRes.data.map((m) => ({ id: m.id!, name: m.name })));
      } catch { /* */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  // ── 自动保存 ──
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; });
  const autoSave = useCallback(async (sweepId: number) => {
    await new Promise((r) => setTimeout(r, 50));
    const sweep = dataRef.current.find((s) => s.id === sweepId);
    if (!sweep) return;
    // 剥离空值 extra 字段
    const clean = sweep.groups.map((g) => g.map((r) => {
      const c = { ...r };
      for (const k of Object.keys(c)) { if (!FIXED_KEYS.has(k) && (c[k] === "" || c[k] === null || c[k] === undefined)) delete c[k]; }
      return c;
    }));
    try { await updateSweep(sweepId, { name: sweep.name, body: JSON.stringify(clean) }); } catch { /* */ }
  }, []);

  // ── 扩展字段 ──
  const extraKeys = useMemo(() => {
    const keys: string[] = []; const seen = new Set<string>();
    for (const s of data) for (const g of s.groups) for (const row of g)
      for (const k of Object.keys(row)) if (!FIXED_KEYS.has(k) && !seen.has(k)) { seen.add(k); keys.push(k); }
    return keys;
  }, [data]);

  // ── CRUD callbacks ──
  const mutate = useCallback((sweepId: number, fn: (prev: SweepItem[]) => SweepItem[]) => {
    setData(fn); autoSave(sweepId);
  }, [autoSave]);

  const setGroupKey = useCallback((sweepId: number, gi: number, ri: number, key: string, value: unknown) => {
    mutate(sweepId, (prev) => prev.map((s) => s.id !== sweepId ? s : {
      ...s, groups: s.groups.map((g, i) => (i !== gi ? g : g.map((r, j) => (j !== ri ? r : { ...r, [key]: value })))),
    }));
  }, [mutate]);

  const updateVars = useCallback((sweepId: number, gi: number, ri: number, vars: string[]) => {
    mutate(sweepId, (prev) => prev.map((s) => s.id !== sweepId ? s : {
      ...s, groups: s.groups.map((g, i) => (i !== gi ? g : g.map((r, j) => (j !== ri ? r : { ...r, vars })))),
    }));
  }, [mutate]);

  const updateSweepName = useCallback((sweepId: number, name: string) => {
    if (!name.trim()) return;
    mutate(sweepId, (prev) => prev.map((s) => (s.id === sweepId ? { ...s, name: name.trim() } : s)));
  }, [mutate]);

  const addGroup = useCallback((sweepId: number, afterIndex: number) => {
    setEditing(null);
    mutate(sweepId, (prev) => prev.map((s) => s.id !== sweepId ? s : {
      ...s, groups: [...s.groups.slice(0, afterIndex + 1), [defaultRow()], ...s.groups.slice(afterIndex + 1)],
    }));
  }, [mutate]);

  const deleteGroup = useCallback((sweepId: number, gi: number) => {
    const sweep = dataRef.current.find((s) => s.id === sweepId);
    if (sweep && sweep.groups.length <= 1) { message.warning("表格不能为空"); return; }
    setEditing(null);
    mutate(sweepId, (prev) => prev.map((s) => s.id !== sweepId ? s : { ...s, groups: s.groups.filter((_, i) => i !== gi) }));
  }, [mutate]);

  const addRow = useCallback((sweepId: number, gi: number, afterRowIndex: number) => {
    setEditing(null);
    mutate(sweepId, (prev) => prev.map((s) => s.id !== sweepId ? s : {
      ...s, groups: s.groups.map((g, i) => (i !== gi ? g : [...g.slice(0, afterRowIndex + 1), defaultRow(), ...g.slice(afterRowIndex + 1)])),
    }));
  }, [mutate]);

  const deleteRow = useCallback((sweepId: number, gi: number, ri: number) => {
    setEditing(null);
    mutate(sweepId, (prev) => prev.map((s) => {
      if (s.id !== sweepId) return s;
      const group = s.groups[gi];
      if (group && group.length <= 1) {
        // 单行组 → 删除整个组
        if (s.groups.length <= 1) { message.warning("表格不能为空"); return s; }
        return { ...s, groups: s.groups.filter((_, i) => i !== gi) };
      }
      return { ...s, groups: s.groups.map((g, i) => (i !== gi ? g : g.filter((_, j) => j !== ri))) };
    }));
  }, [mutate]);

  const setExtra = useCallback((sweepId: number, gi: number, ri: number, key: string, value: string) => {
    mutate(sweepId, (prev) => prev.map((s) => s.id !== sweepId ? s : {
      ...s, groups: s.groups.map((g, i) => i !== gi ? g : g.map((r, j) => {
        if (j !== ri) return r;
        if (value.trim() === "" && Object.prototype.hasOwnProperty.call(r, key)) { const c = { ...r }; delete c[key]; return c; }
        return { ...r, [key]: coerceValue(value) };
      })),
    }));
  }, [mutate]);

  const deleteColumn = useCallback((sweepId: number, key: string) => {
    if (FIXED_KEYS.has(key)) return;
    mutate(sweepId, (prev) => prev.map((s) => s.id !== sweepId ? s : {
      ...s, groups: s.groups.map((g) => g.map((r) => { const c = { ...r }; delete c[key]; return c; })),
    }));
  }, [mutate]);

  // ── 扫描表格增删 ──
  const deleteSweep = useCallback(async (sweepId: number) => {
    setData((prev) => prev.filter((s) => s.id !== sweepId));
    setVisibleIds((prev) => prev.filter((v) => v !== sweepId));
    setAllUserSweeps((prev) => prev.filter((s) => s.id !== sweepId));
    setEditing(null);
    try { await apiDeleteSweep(sweepId); } catch { /* */ }
    try { await unlinkSweepFromCase(caseId, sweepId); } catch { /* */ }
  }, [caseId]);

  const addNewSweep = useCallback(async (templateGroups?: SweepItem["groups"], templateName?: string) => {
    setEditing(null);
    const groups = templateGroups ?? [[defaultRow()]];
    const name = templateName ?? `新扫描${Date.now()}`;
    try {
      const res = await addSweep({ name, body: JSON.stringify(groups) });
      if (!res.data) return;
      const id = res.data.id;
      setData((prev) => [{ id, name, groups }, ...prev]);
      setVisibleIds((prev) => [id, ...prev]);
      await linkSweepToCase(caseId, id);
      setAllUserSweeps((prev) => [...prev, { id, name }]);
    } catch { message.error("创建失败"); }
  }, [caseId]);

  const [tmplModal, setTmplModal] = useState<{
    open: boolean; templates: { name: string; path: string }[]; loading: boolean;
  }>({ open: false, templates: [], loading: false });
  const [tmplSelected, setTmplSelected] = useState<string>("");

  const openTemplateModal = useCallback(async () => {
    setEditing(null);
    setTmplModal({ open: true, templates: [], loading: true });
    setTmplSelected("");
    try {
      const listRes = await fetchSweepTemplates();
      if (!listRes.data?.length) { message.warning("没有可用的模板"); setTmplModal((p) => ({ ...p, open: false, loading: false })); return; }
      setTmplModal({ open: true, templates: listRes.data, loading: false });
    } catch { setTmplModal((p) => ({ ...p, open: false, loading: false })); message.error("获取模板列表失败"); }
  }, []);

  const confirmTemplate = useCallback(async () => {
    if (!tmplSelected) { message.warning("请选择一个模板"); return; }
    setTmplModal((p) => ({ ...p, loading: true }));
    try {
      const detailRes = await fetchSweepTemplate(tmplSelected);
      if (!detailRes.data) { message.error("读取模板失败"); return; }
      const errs = (detailRes.data as any).errors as string[] | undefined;
      if (errs?.length) {
        Modal.warning({ title: "模板校验警告", content: errs.join("\n") });
      }
      await addNewSweep(detailRes.data.groups as SweepItem["groups"], detailRes.data.name);
      setTmplModal((p) => ({ ...p, open: false }));
    } catch { message.error("从模板创建失败"); }
    finally { setTmplModal((p) => ({ ...p, loading: false })); }
  }, [tmplSelected, addNewSweep]);

  const showSweep = useCallback(async (id: number) => {
    if (visibleIds.includes(id)) return;
    if (!dataRef.current.find((s) => s.id === id)) {
      try {
        const res = await batchSweeps([id]);
        if (res.data?.[0]) {
          const m = res.data[0];
          setData((prev) => [...prev, { id: m.id!, name: m.name, groups: (() => { try { return JSON.parse(m.body); } catch { return []; } })() }]);
        }
      } catch { return; }
    }
    setVisibleIds((prev) => [id, ...prev]);
    try { await linkSweepToCase(caseId, id); } catch { /* */ }
  }, [caseId, visibleIds]);

  const hideSweep = useCallback(async (id: number) => {
    setVisibleIds((prev) => prev.filter((v) => v !== id));
    setEditing(null);
    try { await unlinkSweepFromCase(caseId, id); } catch { /* */ }
  }, [caseId]);

  const ops = useMemo<SweepOps>(() => ({ setGroupKey, updateVars, updateSweepName, addGroup, deleteGroup, addRow, deleteRow, setExtra, deleteColumn }),
    [setGroupKey, updateVars, updateSweepName, addGroup, deleteGroup, addRow, deleteRow, setExtra, deleteColumn]);

  const { paths: allPaths, labels } = useMemo(() => extractParamPaths(modelInfo, modelVersion, sysName), [modelInfo, modelVersion, sysName]);

  // ── 渲染 ──
  if (loading) return <div className="flex-1 flex items-center justify-center text-[#999] text-sm">加载中…</div>;

  const visibleSweeps = data.filter((s) => visibleIds.includes(s.id));
  const available = allUserSweeps.filter((s) => !visibleIds.includes(s.id));

  const tableItems: MenuProps["items"] = available.map((s) => ({
    key: String(s.id), label: s.name, icon: <TableOutlined style={{ color: "#3b82f6" }} />,
  }));
  const actionItems: MenuProps["items"] = [
    { key: "__new__", label: "新建扫描表格", icon: <PlusOutlined style={{ color: "#3b82f6" }} /> },
    { key: "__template__", label: "从模板创建", icon: <FileExcelOutlined style={{ color: "#52c41a" }} /> },
  ];

  const onAddMenuClick = ({ key }: { key: string }) => {
    if (key === "__new__") addNewSweep();
    else if (key === "__template__") openTemplateModal();
    else showSweep(Number(key));
  };

  return (
    <div className="flex-1 overflow-auto box-border px-4 py-3 min-w-0 min-h-0">
      <style>{`.sweep-add-dropdown .ant-dropdown-menu{background:transparent!important;box-shadow:none!important;padding:0!important}`}</style>
      <div className="flex items-center gap-3 mb-4">
        <Dropdown
          overlayClassName="sweep-add-dropdown"
          dropdownRender={() => (
            <div className="bg-white rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.08),0_3px_6px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] min-w-[120px]">
              {tableItems && tableItems.length > 0 && (
                <div style={{ maxHeight: 240, overflowY: "auto" }} className="py-1">
                  <Menu items={tableItems} onClick={onAddMenuClick} />
                </div>
              )}
              <div className={`py-1 ${tableItems && tableItems.length > 0 ? "border-t border-[#f0f0f0]" : ""}`}>
                <Menu items={actionItems} onClick={onAddMenuClick} />
              </div>
            </div>
          )}>
          <Button size="small" icon={<PlusOutlined />}>添加表格</Button>
        </Dropdown>
        <span className="text-[12px] text-[#b0b8cc]">从下拉选择扫描配置，或新建一个</span>
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1 mr-2" title="打开后，仿真时将使用表格中的 initValue 替代默认参数">
          <span className="text-[12px] text-[#999]">指标分解</span>
          <Switch size="small" checked={showInitValue} onChange={handleToggleSharding} />
        </span>
      </div>

      <div className="flex flex-col gap-6">
        {visibleSweeps.map((sweep) => (
          <SweepTable key={sweep.id} sweep={sweep} editing={editing} setEditing={setEditing}
            extraKeys={extraKeys} ops={ops} allPaths={allPaths} labels={labels} showInitValue={showInitValue}
            onHide={() => hideSweep(sweep.id)} onDelete={() => deleteSweep(sweep.id)} />
        ))}
      </div>

      <Modal
        title="选择模板"
        open={tmplModal.open}
        onOk={confirmTemplate}
        onCancel={() => setTmplModal((p) => ({ ...p, open: false }))}
        okText="创建"
        cancelText="取消"
        confirmLoading={tmplModal.loading}
      >
        <List
          loading={tmplModal.loading}
          dataSource={tmplModal.templates}
          renderItem={(item) => (
            <List.Item
              onClick={() => setTmplSelected(item.path)}
              className={`cursor-pointer px-3 rounded ${tmplSelected === item.path ? "bg-[#e6f4ff]" : "hover:bg-[#f5f5f5]"}`}
            >
              <FileExcelOutlined className="text-[#52c41a] mr-2" />{item.name}
            </List.Item>
          )}
          locale={{ emptyText: "没有可用的模板" }}
        />
      </Modal>
    </div>
  );
}
