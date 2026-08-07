import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Table, Button, Input, Checkbox, Popconfirm, Popover, message, Modal } from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined, CloseOutlined, TableOutlined, DownOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { ResizeCallbackData } from "react-resizable";

import type { SweepItem, EditTarget, SweepOps, TreeRow } from "./types";
import { sameEdit, rowVal, buildTreeData } from "./utils";
import { dataMenuItems } from "./menus";
import { InlineEdit } from "./InlineEdit";
import { VarsEditor } from "./VarsEditor";
import { ResizableTitle } from "./ResizableTitle";

interface SweepTableProps {
  sweep: SweepItem; editing: EditTarget | null; setEditing: (t: EditTarget | null) => void;
  extraKeys: string[]; ops: SweepOps; onHide: () => void; onDelete: () => void;
  allPaths: string[]; labels: Record<string, string>; showInitValue: boolean;
}

export function SweepTable({ sweep, editing, setEditing, extraKeys, ops, onHide, onDelete, allPaths, labels, showInitValue }: SweepTableProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const handleResize = useCallback((field: string) => (_e: React.SyntheticEvent, { size }: ResizeCallbackData) => {
    setColWidths((p) => ({ ...p, [field]: size.width }));
  }, []);
  const getColWidth = (field: string, def: number) => colWidths[field] ?? def;

  const nameEditing = sameEdit(editing, { kind: "sweepName", sweepId: sweep.id });
  const commitName = (v: string) => { ops.updateSweepName(sweep.id, v); setEditing(null); };

  const treeData = useMemo(() => buildTreeData(sweep.groups), [sweep.groups]);

  const hasData = useMemo(() => sweep.groups.some((g) => g.length > 0), [sweep.groups]);
  const usedVars = useMemo(() => {
    const s = new Set<string>();
    for (const g of sweep.groups) for (const r of g) for (const v of r.vars) if (v) s.add(v);
    return s;
  }, [sweep.groups]);

  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  // ── 右键菜单 ──
  const [ctxMenu, setCtxMenu] = useState<{ gi: number; ri?: number; x: number; y: number } | null>(null);
  const [headerCtx, setHeaderCtx] = useState<{ x: number; y: number } | null>(null);
  const closeCtx = () => { setCtxMenu(null); setHeaderCtx(null); setSelectedRow(null); };
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
    const close = (e: MouseEvent) => {
      if (ctxRef.current?.contains(e.target as Node)) return;
      if (e.type === "contextmenu") { e.preventDefault(); }
      setCtxMenu(null); setHeaderCtx(null); setSelectedRow(null);
    };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", close);
      document.addEventListener("contextmenu", close);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("contextmenu", close);
    };
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
        title: <ResizableTitle width={getColWidth("vars", 200)} onResize={handleResize("vars")}>变量 (vars)</ResizableTitle>,
        width: getColWidth("vars", 200),
        onCell: (record: TreeRow) => record.isGroup ? { style: { paddingTop: 1, paddingBottom: 1 } } : {},
        render: (_v: unknown, record: TreeRow) => {
          const { gi, ri } = record;
          const vars: string[] = (record._vars as string[]) ?? [];
          return (
            <Popover trigger="click" title="变量列表"
              content={<VarsEditor vars={vars} onChange={(vs) => ops.updateVars(sweep.id, gi, ri, vs)} allPaths={allPaths} labels={labels} usedVars={usedVars} />}>
              <div className="cursor-pointer min-w-[120px] py-0.5 hover:bg-[#f0f4ff] rounded">
                {vars.length === 0 ? (
                  <span className="text-[#ff4d4f] text-xs">⚠ 至少需要一个变量</span>
                ) : (
                  <div className="flex flex-col" style={{ lineHeight: 1.3 }}>
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
      ...(showInitValue ? [textCol("initValue", "initValue", 90, true)] : []),
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
          const badFmt = !empty && !/^\d+\.?\d*([eE][+-]?\d+)?$/.test(raw) && (() => { try { return !Array.isArray(JSON.parse(raw)); } catch { return true; } })();
          const t: EditTarget = { kind: "groupText", sweepId: sweep.id, groupIndex: gi, rowIndex: ri, field: "iterValue" };
          const cls = mismatch || empty || badFmt ? "text-[#ff4d4f]" : "";
          const tip = empty ? "iterValue 不能为空" : badFmt ? "须为标量或数组，如 1 或 [1,2,3]" : mismatch ? "组内 iterValue 维度不一致" : undefined;
          return (
            <span className="inline-flex items-center gap-0.5" title={tip}>
              {empty && <span className="text-[#ff4d4f] text-[10px] shrink-0">⚠</span>}
              <span className={cls}>
                <InlineEdit value={raw} isEditing={sameEdit(editing, t)}
                  onStart={() => setEditing(t)}
                  onSave={(v) => {
                    const t = v.trim();
                    if (!t) { setEditing(null); return; }
                    if (/^\d+\.?\d*([eE][+-]?\d+)?$/.test(t)) {
                      // 标量：通过
                    } else {
                      try { if (!Array.isArray(JSON.parse(t))) throw 0; }
                      catch { message.warning("iterValue 须为标量或数组，如 1 或 [1,2,3]"); return; }
                    }
                    ops.setGroupKey(sweep.id, gi, ri, "iterValue", t); setEditing(null);
                  }} />
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
    <div className="rounded-lg">
      <style>{`
        .sweep-table .ant-table-row:hover>td{background:#f0f5ff!important}
        .sweep-table .ant-table-row:nth-child(even):not(:hover)>td{background:transparent!important}
        .sweep-group-inner>td{border-bottom:0!important}
        .sweep-table .ant-table-cell{padding-top:2px!important;padding-bottom:2px!important}
      `}</style>
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-t-lg select-none cursor-pointer group/header"
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
          <Button size="small" style={{ fontSize: 11, color: "#3b82f6", border: "none", background: "transparent", boxShadow: "none" }}
            icon={<CloseOutlined />} title="仅从页面移除，数据保留"
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(59,130,246,0.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            onClick={(e) => { e.stopPropagation(); onHide(); }}>移除</Button>
          <Popconfirm title="删除该扫描配置？删除后数据不可恢复" onConfirm={onDelete}>
            <Button size="small" style={{ fontSize: 11, color: "#ff4d4f", border: "none", background: "transparent", boxShadow: "none" }}
              icon={<DeleteOutlined />} title="从数据中永久删除"
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,77,79,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={(e) => e.stopPropagation()}>删除</Button>
          </Popconfirm>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* 行右键菜单 */}
          {ctxMenu && (
            <>
              <div ref={ctxRef} className="fixed z-[1060] bg-white rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.08),0_3px_6px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] py-1 min-w-[160px]"
                style={{ left: ctxMenu.x, top: ctxMenu.y }}>
                {(ctxMenu.ri !== undefined
                  ? dataMenuItems(ctxMenu.gi, ctxMenu.ri, ops, sweep.id, openAddCol, extraKeys, closeCtx)
                  : []
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
              <div className="fixed inset-0 z-[1050]" onClick={closeCtx} />
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
            className="sweep-table"
            columns={columns} dataSource={treeData} rowKey={(r) => r.key}
            onHeaderRow={() => ({
              onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setHeaderCtx({ x: e.clientX, y: e.clientY }); },
            })}
            onRow={(record) => ({
              onContextMenu: (e: React.MouseEvent) => {
                e.preventDefault();
                setSelectedRow(record.key);
                setCtxMenu({ gi: record.gi, ri: record.ri, x: e.clientX, y: e.clientY });
              },
              className: (() => {
                const g = sweep.groups[record.gi];
                return (g && g.length > 1 && record.ri < g.length - 1) ? "sweep-group-inner" : undefined;
              })(),
              style: { background: selectedRow === record.key ? "#e6f4ff" : undefined, cursor: "pointer" } as React.CSSProperties,
              onClick: () => setSelectedRow((prev) => prev === record.key ? null : record.key),
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
