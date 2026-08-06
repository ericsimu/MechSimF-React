import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Button, Dropdown, message } from "antd";
import type { MenuProps } from "antd";
import { PlusOutlined, DownloadOutlined } from "@ant-design/icons";
import { addSweep, updateSweep, deleteSweep as apiDeleteSweep, batchSweeps, sweepsByCase, sweepsByUser, linkSweepToCase, unlinkSweepFromCase } from "@/api/index";
import { getCurrentUser } from "@/utils/user";
import type { SweepItem, EditTarget, SweepOps } from "./types";
import { defaultRow, coerceValue, exportJson, extractParamPaths, FIXED_KEYS } from "./utils";
import { SweepTable } from "./SweepTable";

interface SweepTabProps {
  caseId: number;
  modelInfo?: Record<string, Record<string, { variables?: Record<string, unknown> }>>;
  modelVersion?: string;
  sysName?: string;
}

export default function SweepTab({ caseId, modelInfo, modelVersion = "", sysName = "" }: SweepTabProps) {
  const [data, setData] = useState<SweepItem[]>([]);
  const [visibleIds, setVisibleIds] = useState<number[]>([]);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [allUserSweeps, setAllUserSweeps] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (sweep && sweep.groups.length <= 1) { message.warning("至少保留一个分组"); return; }
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
      if (group && group.length <= 1) { message.warning("每组至少保留一行"); return s; }
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

  const addNewSweep = useCallback(async () => {
    setEditing(null);
    const name = `新扫描${Date.now()}`;
    try {
      const res = await addSweep({ name, body: JSON.stringify([[defaultRow()]]) });
      if (!res.data) return;
      const id = res.data.id;
      setData((prev) => [...prev, { id, name, groups: [[defaultRow()]] }]);
      setVisibleIds((prev) => [...prev, id]);
      await linkSweepToCase(caseId, id);
      setAllUserSweeps((prev) => [...prev, { id, name }]);
    } catch { message.error("创建失败"); }
  }, [caseId]);

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
    setVisibleIds((prev) => [...prev, id]);
    try { await linkSweepToCase(caseId, id); } catch { /* */ }
  }, [caseId, visibleIds]);

  const hideSweep = useCallback(async (id: number) => {
    setVisibleIds((prev) => prev.filter((v) => v !== id));
    setEditing(null);
    try { await unlinkSweepFromCase(caseId, id); } catch { /* */ }
  }, [caseId]);

  const ops = useMemo<SweepOps>(() => ({ setGroupKey, updateVars, updateSweepName, addGroup, deleteGroup, addRow, deleteRow, setExtra, deleteColumn }),
    [setGroupKey, updateVars, updateSweepName, addGroup, deleteGroup, addRow, deleteRow, setExtra, deleteColumn]);

  const allPaths = useMemo(() => extractParamPaths(modelInfo, modelVersion, sysName), [modelInfo, modelVersion, sysName]);

  // ── 渲染 ──
  if (loading) return <div className="flex-1 flex items-center justify-center text-[#999] text-sm">加载中…</div>;

  const visibleSweeps = data.filter((s) => visibleIds.includes(s.id));
  const available = allUserSweeps.filter((s) => !visibleIds.includes(s.id));

  const addMenuItems: MenuProps["items"] = [
    ...available.map((s) => ({ key: String(s.id), label: s.name })),
    ...(available.length > 0 ? [{ type: "divider" as const }] : []),
    { key: "__new__", label: "新建扫描表格", icon: <PlusOutlined /> },
  ];

  const onAddMenuClick = ({ key }: { key: string }) => {
    if (key === "__new__") addNewSweep(); else showSweep(Number(key));
  };

  return (
    <div className="flex-1 overflow-auto box-border px-4 py-3 min-w-0 min-h-0">
      <div className="flex items-center gap-3 mb-4">
        <Dropdown menu={{ items: addMenuItems, onClick: onAddMenuClick }}>
          <Button size="small" icon={<PlusOutlined />}>添加表格</Button>
        </Dropdown>
        <span className="text-[12px] text-[#b0b8cc]">从下拉选择要显示的扫描配置，或新建一个</span>
        <div className="flex-1" />
        <Button size="small" icon={<DownloadOutlined />} onClick={() => exportJson(data)}>导出JSON</Button>
      </div>

      {visibleSweeps.length === 0 && !loading && (
        <div className="rounded-lg border border-dashed border-[#d9e0ee] py-20 text-center text-[#999]">
          <div className="mb-2">暂无显示的扫描配置</div>
          <Dropdown menu={{ items: addMenuItems, onClick: onAddMenuClick }}>
            <Button size="small" type="primary" icon={<PlusOutlined />}>添加表格</Button>
          </Dropdown>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {visibleSweeps.map((sweep) => (
          <SweepTable key={sweep.id} sweep={sweep} editing={editing} setEditing={setEditing}
            extraKeys={extraKeys} ops={ops} allPaths={allPaths}
            onHide={() => hideSweep(sweep.id)} onDelete={() => deleteSweep(sweep.id)} />
        ))}
      </div>
    </div>
  );
}
