import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Table, Button, Input, Checkbox, Popconfirm, Popover, Dropdown, message, Modal } from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined, CloseOutlined, TableOutlined, DownOutlined, RightOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { ResizeCallbackData } from "react-resizable";

import type { SweepItem, SweepRow, EditTarget, SweepOps, TreeRow } from "./types";
import { sameEdit, exportJson, rowVal, FIXED_KEYS, coerceValue } from "./utils";
import { groupMenuItems, dataMenuItems } from "./menus";
import { InlineEdit } from "./InlineEdit";
import { VarsEditor } from "./VarsEditor";
import { ResizableTitle } from "./ResizableTitle";

interface SweepTableProps {
  sweep: SweepItem; editing: EditTarget | null; setEditing: (t: EditTarget | null) => void;
  extraKeys: string[]; ops: SweepOps; onHide: () => void; onDelete: () => void;
  allPaths: string[];
}

export function SweepTable({ sweep, editing, setEditing, extraKeys, ops, onHide, onDelete, allPaths }: SweepTableProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const handleResize = useCallback((field: string) => (_e: React.SyntheticEvent, { size }: ResizeCallbackData) => {
    setColWidths((p) => ({ ...p, [field]: size.width }));
  }, []);
  const getColWidth = (field: string, def: number) => colWidths[field] ?? def;

  const nameEditing = sameEdit(editing, { kind: "sweepName", sweepId: sweep.id });
  const commitName = (v: string) => { ops.updateSweepName(sweep.id, v); setEditing(null); };

  const treeData = useMemo(() => {
    return sweep.groups.map((group, gi) => ({
      key: `g${gi}`, isGroup: true as const, gi, ri: -1,
      children: (group.length > 0 ? group : [{ vars: [], type: "Q", initValue: "", iterValue: "", isSim: true, simTraj: true } as SweepRow])
        .map((row, ri) => {
          const extras: Record<string, unknown> = {};
          for (const k of Object.keys(row)) { if (!FIXED_KEYS.has(k)) extras[k] = row[k]; }
          return {
            key: `g${gi}-r${ri}`, isGroup: false as const, gi, ri,
            _vars: row.vars, _type: row.type, _initValue: row.initValue,
            _iterValue: row.iterValue, _isSim: row.isSim, _simTraj: row.simTraj, _extras: extras,
          };
        }),
    }));
  }, [sweep.groups]);

  const hasData = useMemo(() => sweep.groups.some((g) => g.length > 0), [sweep.groups]);
  const usedVars = useMemo(() => {
    const s = new Set<string>();
    for (const g of sweep.groups) for (const r of g) for (const v of r.vars) if (v) s.add(v);
    return s;
  }, [sweep.groups]);

  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  useEffect(() => {
    const gk = treeData.filter((r) => r.isGroup).map((r) => r.key);
    setExpandedKeys((prev) => { const s = new Set(prev); gk.forEach((k) => s.add(k)); return Array.from(s); });
  }, [treeData]);

  // ── 右键菜单 ──
  const [ctxMenu, setCtxMenu] = useState<{ gi: number; ri?: number; x: number; y: number } | null>(null);
  const [headerCtx, setHeaderCtx] = useState<{ x: number; y: number } | null>(null);
  const closeCtx = () => { setCtxMenu(null); setHeaderCtx(null); };
  const ctxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ctxMenu || !ctxRef.current) return;
    const el = ctxRef.current;
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth) el.style.left = `${ctxMenu.x - r.width}px`;
    if (r.bottom > window.innerHeight) el.style.top = `${ctxMenu.y - r.height}px`;
  }, [ctxMenu]);

  useEffect(() => {
    if (!ctxMenu && !headerCtx) return;
    const close = () => { setCtxMenu(null); setHeaderCtx(null); };
    const t = setTimeout(() => document.addEventListener("click", close), 0);
    return () => { clearTimeout(t); document.removeEventListener("click", close); };
  }, [ctxMenu, headerCtx]);

  // ── 插入列弹窗 ──
  const [colModal, setColModal] = useState<{ open: boolean; gi: number; ri: number }>({ open: false, gi: 0, ri: 0 });
  const [colName, setColName] = useState("");
  const openAddCol = useCallback((gi: number, ri: number) => { setColModal({ open: true, gi, ri }); setColName(""); }, []);
  const confirmAddCol = () => {
    const name = colName.trim();
    if (!name) { setColModal((p) => ({ ...p, open: false })); return; }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) { message.warning("列名只能由字母、数字、下划线组成，且不能以数字开头"); return; }
    ops.setExtra(sweep.id, colModal.gi, colModal.ri, name, "");
    setColModal((p) => ({ ...p, open: false }));
  };

  // ── 列定义 ──
  const columns = useMemo((): ColumnsType<TreeRow> => {
    const validPathSet = new Set(allPaths);

    function textCol(title: string, field: string, width: number, required = false): ColumnsType<TreeRow>[number] {
      const w = getColWidth(field, width);
      return {
        title: <ResizableTitle width={w} onResize={handleResize(field)}>{title}</ResizableTitle>,
        width: w,
        onCell: (record: TreeRow) => record.isGroup ? { style: { paddingTop: 1, paddingBottom: 1 } } : {},
        render: (_v: unknown, record: TreeRow) => {
          if (record.isGroup) return null;
          const raw = String(rowVal(record, field) ?? "");
          const empty = required && !raw;
          const t: EditTarget = { kind: "groupText", sweepId: sweep.id, groupIndex: record.gi, rowIndex: record.ri, field };
          return (
            <span className="inline-flex items-center gap-0.5" title={empty ? `${title} 不能为空` : undefined}>
              {empty && <span className="text-[#ff4d4f] text-[10px] shrink-0">⚠</span>}
              <span className={empty ? "text-[#ff4d4f]" : ""}>
                <InlineEdit value={raw} isEditing={sameEdit(editing, t)}
                  onStart={() => setEditing(t)}
                  onSave={(v) => {
                    if (required && !v.trim()) return;
                    ops.setGroupKey(sweep.id, record.gi, record.ri, field, v); setEditing(null);
                  }} />
              </span>
            </span>
          );
        },
      };
    }

    return [
      {
        title: <ResizableTitle width={getColWidth("vars", 120)} onResize={handleResize("vars")}>变量 (vars)</ResizableTitle>,
        width: getColWidth("vars", 120),
        onCell: (record: TreeRow) => record.isGroup ? { style: { paddingTop: 1, paddingBottom: 1 } } : {},
        render: (_v: unknown, record: TreeRow) => {
          if (record.isGroup) return <span className="text-[10px] text-[#d9d9d9] select-none">分组 {record.gi + 1}</span>;
          const { gi, ri } = record;
          const vars: string[] = (record._vars as string[]) ?? [];
          return (
            <Popover trigger="click" title="变量列表"
              content={<VarsEditor vars={vars} onChange={(vs) => ops.updateVars(sweep.id, gi, ri, vs)} allPaths={allPaths} usedVars={usedVars} />}>
              <div className="cursor-pointer min-w-[120px] py-0.5 hover:bg-[#f0f4ff] rounded">
                {vars.length === 0 ? (
                  <span className="text-[#ff4d4f] text-xs">⚠ 至少需要一个变量</span>
                ) : (
                  <div className="flex flex-col">
                    {vars.map((v, i) => {
                      const empty = !v;
                      const ok = allPaths.length === 0 || validPathSet.has(v);
                      return (
                        <div key={i}
                          className={`text-[12px] leading-[20px] break-all ${empty ? "text-[#ff4d4f] italic" : ok ? "" : "text-[#faad14]"}`}
                          title={empty ? "变量名不能为空" : ok ? v : `⚠ ${v} — 在当前系统/版本中不存在`}>
                          {empty ? "⚠ (空)" : !ok ? `⚠ ${v}` : v}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Popover>
          );
        },
      },
      textCol("type", "type", 70, true),
      textCol("initValue", "initValue", 90, true),
      {
        title: <ResizableTitle width={getColWidth("iterValue", 140)} onResize={handleResize("iterValue")}>iterValue</ResizableTitle>,
        width: getColWidth("iterValue", 140),
        onCell: (record: TreeRow) => record.isGroup ? { style: { paddingTop: 1, paddingBottom: 1 } } : {},
        render: (_v: unknown, record: TreeRow) => {
          if (record.isGroup) return null;
          const { gi, ri } = record;
          const raw = String(rowVal(record, "iterValue") ?? "");
          const group = sweep.groups[gi];
          let mismatch = false;
          if (group && group.length > 1) {
            const lens = group.map((r) => { try { return JSON.parse(r.iterValue || "[]").length; } catch { return 0; } });
            mismatch = lens[ri] !== lens[0];
          }
          const empty = !raw;
          const t: EditTarget = { kind: "groupText", sweepId: sweep.id, groupIndex: gi, rowIndex: ri, field: "iterValue" };
          const cls = mismatch || empty ? "text-[#ff4d4f]" : "";
          const tip = empty ? "iterValue 不能为空" : mismatch ? "组内 iterValue 维度不一致" : undefined;
          return (
            <span className="inline-flex items-center gap-0.5" title={tip}>
              {empty && <span className="text-[#ff4d4f] text-[10px] shrink-0">⚠</span>}
              <span className={cls}>
                <InlineEdit value={raw} isEditing={sameEdit(editing, t)}
                  onStart={() => setEditing(t)}
                  onSave={(v) => { if (!v.trim()) return; ops.setGroupKey(sweep.id, gi, ri, "iterValue", v); setEditing(null); }} />
              </span>
            </span>
          );
        },
      },
      {
        title: "isSim", width: 55,
        onCell: (record: TreeRow) => record.isGroup ? { style: { paddingTop: 1, paddingBottom: 1 } } : {},
        render: (_v: unknown, record: TreeRow) => {
          if (record.isGroup) return null;
          return <Checkbox checked={!!record._isSim} onChange={(e) => ops.setGroupKey(sweep.id, record.gi, record.ri, "isSim", e.target.checked)} />;
        },
      },
      {
        title: "simTraj", width: 60,
        onCell: (record: TreeRow) => record.isGroup ? { style: { paddingTop: 1, paddingBottom: 1 } } : {},
        render: (_v: unknown, record: TreeRow) => {
          if (record.isGroup) return null;
          return <Checkbox checked={!!record._simTraj} onChange={(e) => ops.setGroupKey(sweep.id, record.gi, record.ri, "simTraj", e.target.checked)} />;
        },
      },
      ...extraKeys.map((key): ColumnsType<TreeRow>[number] => ({
        title: <ResizableTitle width={getColWidth(key, 110)} onResize={handleResize(key)}>{key}</ResizableTitle>,
        width: getColWidth(key, 110),
        onCell: (record: TreeRow) => record.isGroup ? { style: { paddingTop: 1, paddingBottom: 1 } } : {},
        render: (_v: unknown, record: TreeRow) => {
          if (record.isGroup) return null;
          const val = record._extras?.[key];
          const t: EditTarget = { kind: "extra", sweepId: sweep.id, groupIndex: record.gi, rowIndex: record.ri, field: key };
          const disp = val === undefined || val === null ? "" : (typeof val === "number" && (Math.abs(val) < 0.001 || Math.abs(val) >= 1e6)) ? val.toExponential(2) : String(val);
          return (
            <InlineEdit value={disp} isEditing={sameEdit(editing, t)}
              onStart={() => setEditing(t)}
              onSave={(v) => { if (v && isNaN(Number(v))) { message.warning("扩展列只接受数字"); return; } ops.setExtra(sweep.id, record.gi, record.ri, key, v); setEditing(null); }}
              placeholder="—" />
          );
        },
      })),
    ];
  }, [sweep.id, sweep.groups, editing, extraKeys, ops, allPaths, colWidths, handleResize, getColWidth, usedVars]);

  return (
    <div className="rounded-lg border border-[#e5e9f2]">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-[#e5e9f2] rounded-t-lg select-none cursor-pointer group/header"
        onClick={() => setCollapsed((c) => !c)}>
        <span className="inline-flex text-[#999] transition-transform duration-150 shrink-0"
          style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
          <DownOutlined style={{ fontSize: 10 }} />
        </span>
        <TableOutlined style={{ color: "#3b82f6", fontSize: 13 }} />
        {nameEditing ? (
          <Input size="small" defaultValue={sweep.name} autoFocus style={{ width: 140 }}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => commitName(e.target.value)}
            onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
            onKeyDown={(e) => { if (e.key === "Escape") (e.target as HTMLInputElement).blur(); }} />
        ) : (
          <span className="text-[13px] font-medium text-[#333]">{sweep.name}</span>
        )}
        {!nameEditing && (
          <EditOutlined className="text-[11px] text-[#bfbfbf] hover:text-[#3b82f6] cursor-pointer shrink-0"
            title="修改名称" onClick={(e) => { e.stopPropagation(); setEditing({ kind: "sweepName", sweepId: sweep.id }); }} />
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity">
          <Button size="small" type="text" className="!text-[11px]"
            icon={<CloseOutlined />} onClick={(e) => { e.stopPropagation(); onHide(); }}>移除</Button>
          <Popconfirm title="删除该扫描配置？删除后数据不可恢复" onConfirm={onDelete}>
            <Button size="small" type="text" danger className="!text-[11px]"
              icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()}>删除</Button>
          </Popconfirm>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* 行右键菜单 */}
          {ctxMenu && (
            <>
              <div className="fixed inset-0 z-[1050]" onClick={closeCtx} onContextMenu={(e) => { e.preventDefault(); closeCtx(); }} />
              <div ref={ctxRef} className="fixed z-[1060] bg-white rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.08),0_3px_6px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] py-1 min-w-[160px]"
                style={{ left: ctxMenu.x, top: ctxMenu.y }}>
                {(ctxMenu.ri !== undefined
                  ? dataMenuItems(ctxMenu.gi, ctxMenu.ri, ops, sweep.id, openAddCol, extraKeys, closeCtx)
                  : groupMenuItems(ctxMenu.gi, sweep.groups[ctxMenu.gi]?.length ?? 1, ops, sweep.id, openAddCol, extraKeys, closeCtx)
                )!.map((item, idx) => {
                  if (!item) return null;
                  if ("type" in item && item.type === "divider") return <div key={`div-${idx}`} className="border-t border-[#f0f0f0] my-1" />;
                  const mi = item as { key: string; label: string; icon?: React.ReactNode; danger?: boolean; onClick?: () => void };
                  return (
                    <div key={mi.key} className={`px-3 py-1.5 text-[13px] cursor-pointer hover:bg-[#f0f4ff] flex items-center gap-2 ${mi.danger ? "text-[#ff4d4f]" : "text-[#333]"}`}
                      onClick={mi.onClick}>{mi.icon}<span>{mi.label}</span></div>
                  );
                })}
              </div>
            </>
          )}

          {/* 表头右键菜单 */}
          {headerCtx && (
            <>
              <div className="fixed inset-0 z-[1050]" onClick={closeCtx} onContextMenu={(e) => { e.preventDefault(); closeCtx(); }} />
              <div className="fixed z-[1060] bg-white rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.08),0_3px_6px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] py-1 min-w-[160px]"
                style={{ left: headerCtx.x, top: headerCtx.y }}>
                <div key="add-col-header" className="px-3 py-1.5 text-[13px] cursor-pointer hover:bg-[#f0f4ff] flex items-center gap-2 text-[#333]"
                  onClick={() => { closeCtx(); openAddCol(0, 0); }}>
                  <PlusOutlined /><span>插入列</span>
                </div>
                {extraKeys.length > 0 && extraKeys.map((k) => (
                  <div key={`hdr-del-${k}`} className="px-3 py-1.5 text-[13px] cursor-pointer hover:bg-[#f0f4ff] flex items-center gap-2 text-[#ff4d4f]"
                    onClick={() => { ops.deleteColumn(sweep.id, k); closeCtx(); }}>
                    <DeleteOutlined /><span>删除列「{k}」</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <Table<TreeRow>
            columns={columns} dataSource={treeData} rowKey={(r) => r.key}
            onHeaderRow={() => ({
              onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setHeaderCtx({ x: e.clientX, y: e.clientY }); },
            })}
            expandable={{
              expandedRowKeys: expandedKeys, indentSize: 20,
              onExpandedRowsChange: (keys) => setExpandedKeys(keys as string[]),
              expandIcon: ({ expanded, onExpand, record }) =>
                record.isGroup ? (
                  <span className="inline-flex items-center justify-center cursor-pointer text-[#bfbfbf] hover:text-[#3b82f6] transition-colors shrink-0"
                    style={{ width: 18, height: 18 }} onClick={(e) => { onExpand(record, e); }}>
                    {expanded ? <DownOutlined style={{ fontSize: 9 }} /> : <RightOutlined style={{ fontSize: 9 }} />}
                  </span>
                ) : null,
            }}
            onRow={(record) => ({
              onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setCtxMenu({ gi: record.gi, ri: record.isGroup ? undefined : record.ri, x: e.clientX, y: e.clientY }); },
              ...(record.isGroup ? {
                style: { background: "#fafbfc", borderTop: record.gi > 0 ? "1px solid #f0f0f0" : undefined, cursor: "pointer" } as React.CSSProperties,
                onClick: () => setExpandedKeys((prev) => prev.includes(record.key) ? prev.filter((k) => k !== record.key) : [...prev, record.key]),
              } : {}),
            })}
            size="small" pagination={false} showHeader={hasData} scroll={{ x: "max-content" }}
            locale={{ emptyText: "暂无数据" }}
          />

          <Modal title="插入新列" open={colModal.open} onOk={confirmAddCol}
            onCancel={() => setColModal((p) => ({ ...p, open: false }))} okText="确定" cancelText="取消">
            <Input placeholder="请输入新列名" value={colName} onChange={(e) => setColName(e.target.value)}
              onPressEnter={confirmAddCol} autoFocus />
          </Modal>
        </>
      )}
    </div>
  );
}
