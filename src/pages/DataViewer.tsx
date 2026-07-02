import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Button, Input, message, Spin, Table, Tabs } from "antd";
import { BarChartOutlined, FundOutlined } from "@ant-design/icons";
import { getTaskStatus, getTaskDataColumns, getTaskSignals, getTaskIndication } from "../api/index";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { isNil } from "../utils/isNil";

// ── 常量 / 工具函数 ──

const COLORS = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f97316"];

function fmtNum(v: number): string {
  if (!isFinite(v)) return String(v);
  const av = Math.abs(v);
  if (av === 0) return "0";
  if (av < 0.001 || av >= 10000) return v.toExponential(4);
  const s = v.toFixed(10);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

// ── 光标标签 ──

type Cursors = { hook: (u: any) => void; destroy: () => void };

function makeCursorLabels(container: HTMLElement, xUnit: string): Cursors {
  const labels: HTMLDivElement[] = [];
  const removeAll = () => { labels.forEach((l) => l.remove()); labels.length = 0; };
  container.addEventListener("mouseleave", removeAll);
  return {
    hook(u: any) {
      try {
        removeAll();
        const idx = u.cursor?.idx;
        if (isNil(idx)) return;
        const xVal = u.data[0][idx];
        const xLeft = u.valToPos(xVal, "x");
        const xl = document.createElement("div");
        xl.style.cssText = `position:absolute;left:${xLeft+4}px;bottom:22px;font-size:10px;color:#fff;background:rgba(0,0,0,0.72);padding:1px 4px;border-radius:2px;pointer-events:none;white-space:nowrap;z-index:100;`;
        xl.textContent = `${fmtNum(xVal)} ${xUnit}`;
        container.appendChild(xl); labels.push(xl);
        for (let i = 1; i < u.series.length; i++) {
          const y = u.data[i]?.[idx];
          if (isNil(y)) continue;
          const d = document.createElement("div");
          d.style.cssText = `position:absolute;left:${xLeft+6}px;top:${u.valToPos(y,"y")-14}px;font-size:10px;color:#fff;background:rgba(0,0,0,0.78);padding:1px 5px;border-radius:2px;border-left:2px solid ${u.series[i].stroke||"#888"};pointer-events:none;white-space:nowrap;z-index:100;line-height:1.5;`;
          d.textContent = `${u.series[i].label||""}:${fmtNum(y)}`;
          container.appendChild(d); labels.push(d);
        }
      } catch { /* keep cursor working */ }
    },
    destroy() { removeAll(); container.removeEventListener("mouseleave", removeAll); },
  };
}

// ── 数据类型 ──

type TaskInfo = {
  id: number; name: string; status: string; error: string;
  sigNames: string[]; fftNames: string[];
  cache: Record<string, number[] | null>;
};

type Plot = { taskId: number; label: string; color: string; data: number[] | null };

// ── 组件 ──

/** 数据查看页：/data?ids=1,2,3（单/多任务信号叠加） */
export default function DataViewer() {
  // ── state ──
  const location = useLocation();
  const ids = useMemo(
    () => (new URLSearchParams(location.search).get("ids") || "")
      .split(",").map(Number).filter((n) => !isNaN(n) && n > 0),
    [location.search],
  );

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState("");
  const [taskExpanded, setTaskExpanded] = useState<Record<number, boolean>>({});
  const [leftWidth, setLeftWidth] = useState(260);
  const [exporting, setExporting] = useState(false);
  const [indicationData, setIndicationData] = useState<Record<number, { rs: { headers: string[]; rows: string[][] } | null; ws: { headers: string[]; rows: string[][] } | null }>>({});
  const [indicationLoading, setIndicationLoading] = useState(false);
  const [perfActive, setPerfActive] = useState(false);

  // ── refs ──
  const tasksRef = useRef(tasks); tasksRef.current = tasks;
  const izTimeRef = useRef(false);  // 时域是否已缩放
  const izFreqRef = useRef(false);  // 频域是否已缩放
  const fullCacheRef = useRef<Record<string, Record<string, number[] | null>>>({});

  const timeChartRef = useRef<HTMLDivElement>(null);
  const freqChartRef = useRef<HTMLDivElement>(null);
  const timeInst = useRef<any>(null);
  const freqInst = useRef<any>(null);
  const timeLbls = useRef<Cursors | null>(null);
  const freqLbls = useRef<Cursors | null>(null);

  // ── 侧边栏宽度拖拽 ──
  function startResize(e: React.MouseEvent) {
    const body = (e.target as HTMLElement).parentElement!;
    const bodyLeft = body.getBoundingClientRect().left;
    const bodyW = body.offsetWidth;
    document.body.style.userSelect = "none";
    function onMove(ev: MouseEvent) { setLeftWidth(Math.min(bodyW*.6, Math.max(180, ev.clientX-bodyLeft))); }
    function onUp() {
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ── 还原全量缓存（zoom → full） ──
  function restoreFullCache() {
    const full = fullCacheRef.current;
    if (!Object.keys(full).length) return;
    setTasks((prev) => {
      const next = [...prev];
      for (const tidStr of Object.keys(full)) {
        const idx = next.findIndex((t) => String(t.id) === tidStr);
        if (idx >= 0) next[idx] = { ...next[idx], cache: { ...full[tidStr] } };
      }
      return next;
    });
    fullCacheRef.current = {};
    izTimeRef.current = false;
    izFreqRef.current = false;
  }

  // ── 加载任务 ──
  useEffect(() => {
    let cancelled = false;
    if (ids.length === 0) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      const results: TaskInfo[] = [];
      for (const id of ids) {
        try {
          const sr = await getTaskStatus(id);
          const status = sr.success && sr.data ? sr.data.status || "" : "";
          const error = sr.success && sr.data ? sr.data.error || "" : "";
          let sigNames: string[] = [];
          let fftNames: string[] = [];
          if (status === "done") {
            const cr = await getTaskDataColumns(id);
            if (cr.success && cr.data) {
              sigNames = (cr.data.column_names || []).filter((n: string) => n.toLowerCase() !== "time");
              fftNames = (cr.data.fft_column_names || []).filter((n: string) => n.toLowerCase() !== "frequency");
            }
          }
          results.push({ id, name: `任务#${id}`, status, error, sigNames, fftNames, cache: {} });
        } catch {
          results.push({ id, name: `任务#${id}`, status: "failed", error: "加载任务信息失败", sigNames: [], fftNames: [], cache: {} });
        }
      }
      if (!cancelled) { setTasks(results); setChecked({}); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [ids]);

  // ── 获取单个信号 ──
  async function fetchOne(taskId: number, sigName: string, domain: "time" | "fft") {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const cacheKey = domain === "fft" ? `fft::${sigName}` : sigName;
    if (task.cache[cacheKey] !== undefined) return;
    const r = await getTaskSignals(taskId, [sigName], domain, undefined, undefined, domain === "fft");
    const col = r.success && r.data ? r.data.columns.find((c: any) => c.name === sigName) : undefined;
    const data = col ? col.data.map((v: any) => (isNil(v) ? null : Number(v))) : null;
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === taskId);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], cache: { ...next[idx].cache, [cacheKey]: data as number[] | null } };
      return next;
    });
  }

  // ── 勾选/取消信号 ──
  function toggle(key: string, taskId: number, sigName: string, domain: "time" | "fft") {
    const newVal = !checked[key];
    setChecked((prev) => ({ ...prev, [key]: newVal }));
    if (!newVal) return;
    // 缩放状态下勾选新信号 → 先还原全量
    if (izTimeRef.current || izFreqRef.current) restoreFullCache();
    fetchOne(taskId, sigName, domain);
  }

  function toggleAllOff() { setChecked({}); }

  // ── 导出CSV ──
  async function exportCSV() {
    const checkedTime = Object.entries(checked).filter(
      ([k, v]) => v && !k.includes("::fft::"),
    );
    if (checkedTime.length === 0) { message.warning("请先勾选需要导出的信号"); return; }

    setExporting(true);
    try {
      // 按任务分组：{ taskId → [sigName, ...] }
      const byTask = new Map<number, string[]>();
      checkedTime.forEach(([k]) => {
        const [tidStr, sigName] = k.split("::");
        const tid = Number(tidStr);
        if (!byTask.has(tid)) byTask.set(tid, []);
        byTask.get(tid)!.push(sigName);
      });

      // 为每个任务拉取 time + 信号数据
      const allColumns: { name: string; data: (number | null)[] }[] = [];
      let timeData: (number | null)[] | null = null;

      for (const [tid, sigNames] of byTask.entries()) {
        try {
          const r = await getTaskSignals(tid, ["time", ...sigNames], "time", undefined, undefined, true);
          if (r.success && r.data) {
            if (!timeData) {
              const tc = r.data.columns.find((c: any) => c.name === "time");
              if (tc) timeData = tc.data.map((v: any) => (isNil(v) ? null : Number(v)));
            }
            for (const sn of sigNames) {
              const sc = r.data.columns.find((c: any) => c.name === sn);
              if (sc) {
                allColumns.push({
                  name: `任务#${tid}_${sn}`,
                  data: sc.data.map((v: any) => (isNil(v) ? null : Number(v))),
                });
              }
            }
          }
        } catch { /* skip failed task */ }
      }

      if (allColumns.length === 0) return;

      const headers = timeData ? ["time", ...allColumns.map((c) => c.name)] : allColumns.map((c) => c.name);
      const nRows = timeData ? timeData.length : allColumns[0].data.length;
      const rows: string[] = [headers.join(",")];
      for (let i = 0; i < nRows; i++) {
        const row: string[] = [];
        if (timeData) row.push(timeData[i]?.toString() ?? "");
        for (const col of allColumns) {
          row.push(col.data[i]?.toString() ?? "");
        }
        rows.push(row.join(","));
      }

      const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `data_export_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  // ── 拖拽缩放 ──
  const makeSelectHandler = useCallback((domain: "time" | "fft") => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: { start: number; end: number } | null = null;
    return (u: any) => {
      if (u.select && u.select.width > 5) {
        const xMin = u.posToVal(u.select.left, "x");
        const xMax = u.posToVal(u.select.left + u.select.width, "x");
        pending = { start: Math.min(xMin, xMax), end: Math.max(xMin, xMax) };
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!pending) return;
        const rng = pending; pending = null;
        const zoomed = domain === "time" ? izTimeRef.current : izFreqRef.current;

        if (!zoomed) {
          const full: Record<string, Record<string, number[] | null>> = {};
          tasksRef.current.forEach((t) => { full[String(t.id)] = { ...t.cache }; });
          fullCacheRef.current = full;
        }

        // 解析图例标签 → 按任务分组
        const sigLabels: string[] = u.series.slice(1).map((s: any) => s.label).filter(Boolean);
        const byTask = new Map<number, string[]>();
        sigLabels.forEach((label: string) => {
          const m = label.match(/^任务#(\d+)\/(.+)$/);
          if (m) { const a = byTask.get(Number(m[1])) || []; a.push(m[2]); byTask.set(Number(m[1]), a); }
        });

        const raw = domain === "fft" || (rng.end - rng.start < 1.0);
        await Promise.all(
          Array.from(byTask.entries()).map(async ([tid, names]) => {
            const reqNames = domain === "time" && !names.includes("time") ? ["time", ...names] : names;
            const r = await getTaskSignals(tid, reqNames, domain, rng.start, rng.end, raw);
            if (r.success && r.data) {
              setTasks((prev) => {
                const idx = prev.findIndex((t) => t.id === tid);
                if (idx < 0) return prev;
                const next = [...prev];
                const newCache = { ...next[idx].cache };
                r.data!.columns.forEach((c: any) => {
                  const cacheKey = domain === "fft" ? `fft::${c.name}` : c.name;
                  newCache[cacheKey] = c.data.map((v: any) => (isNil(v) ? null : Number(v)));
                });
                next[idx] = { ...next[idx], cache: newCache };
                return next;
              });
            }
          }),
        );
        if (domain === "time") izTimeRef.current = true;
        else izFreqRef.current = true;
      }, 200);
    };
  }, []);

  // ── 双击还原 ──
  const makeDblHandler = useCallback((domain: "time" | "fft") => {
    return () => {
      if (!(domain === "time" ? izTimeRef.current : izFreqRef.current)) return;
      restoreFullCache();
    };
  }, []);

  // ── 时域图 ──
  useEffect(() => {
    timeLbls.current?.destroy(); timeLbls.current = null;
    timeInst.current?.destroy(); timeInst.current = null;
    const el = timeChartRef.current; if (!el) return;

    const plots: Plot[] = [];
    Object.entries(checked).filter(([k, v]) => v && !k.includes("::fft::")).forEach(([k], pi) => {
      const [tidStr, sigName] = k.split("::");
      const tt = tasks.find((t) => t.id === Number(tidStr));
      if (!tt) return;
      plots.push({ taskId: tt.id, label: `${tt.name}/${sigName}`, color: COLORS[pi % COLORS.length], data: tt.cache[sigName] ?? null });
    });
    if (plots.length === 0) return;

    const xTask =
      tasks.find((t) => t.cache["time"] && (t.cache["time"] as number[]).length > 0 && plots.some((p) => p.taskId === t.id)) ||
      tasks.find((t) => t.cache["time"] && (t.cache["time"] as number[]).length > 0);
    const maxLen = plots.reduce((m, p) => p.data ? Math.max(m, p.data.length) : m, 0);
    const xAxis: number[] = xTask ? (xTask.cache["time"] as number[]).slice(0, maxLen) : Array.from({ length: maxLen }, (_, i) => i);

    const lbls = makeCursorLabels(el, "s"); timeLbls.current = lbls;
    const series: Array<object> = [{ label: xTask ? "Time (s)" : "Index" }];
    const arrays: Array<Array<number | null>> = [];
    plots.forEach((p) => {
      series.push({ label: p.label, stroke: p.color, width: 2, value: (_u: unknown, v: number) => v == null ? "" : fmtNum(v) });
      arrays.push((p.data || []).slice(0, maxLen).map((v) => (v == null ? null : v)));
    });

    try {
      timeInst.current = new (uPlot as any)(
        { width: el.offsetWidth || 800, height: 300, cursor: { show: true, drag: { setScale: true, x: true, y: false } }, legend: { show: true }, scales: { x: { time: false } },
          axes: [
            { label: xTask ? "Time (s)" : "Index", grid: { stroke: "#f0f0f0" }, stroke: "#888", values: (_s: any, ticks: number[]) => ticks.map((t: number) => fmtNum(t) + " s") },
            { stroke: "#888", grid: { stroke: "#f0f0f0" }, size: 85, values: (_s: any, ticks: number[]) => ticks.map((t: number) => fmtNum(t)) },
          ],
          series, hooks: { setCursor: [lbls.hook], setSelect: [makeSelectHandler("time")] },
        },
        [xAxis, ...arrays], el,
      );
      const overEl = el.querySelector(".u-over") as HTMLElement | null;
      (overEl || el).addEventListener("dblclick", makeDblHandler("time"));
    } catch { /* */ }
  }, [tasks, checked, makeSelectHandler, makeDblHandler]);

  // ── 频域图 ──
  useEffect(() => {
    freqLbls.current?.destroy(); freqLbls.current = null;
    freqInst.current?.destroy(); freqInst.current = null;
    const el = freqChartRef.current; if (!el) return;

    const plots: Plot[] = [];
    Object.entries(checked).filter(([k, v]) => v && k.includes("::fft::")).forEach(([k], pi) => {
      const m = k.match(/^(\d+)::fft::(.+)$/); if (!m) return;
      const tt = tasks.find((t) => t.id === Number(m[1]));
      if (!tt) return;
      plots.push({ taskId: tt.id, label: `${tt.name}/${m[2]}`, color: COLORS[pi % COLORS.length], data: tt.cache[`fft::${m[2]}`] ?? null });
    });
    if (plots.length === 0) return;

    const xTask =
      tasks.find((t) => t.cache["frequency"] && (t.cache["frequency"] as number[]).length > 0 && plots.some((p) => p.taskId === t.id)) ||
      tasks.find((t) => t.cache["frequency"] && (t.cache["frequency"] as number[]).length > 0);
    if (!xTask) return;
    const freq = xTask.cache["frequency"] as number[];

    const lbls = makeCursorLabels(el, ""); freqLbls.current = lbls;
    const series: Array<object> = [{ label: "Frequency (Hz)" }];
    plots.forEach((p) => {
      series.push({ label: p.label, stroke: p.color, width: 2, value: (_u: unknown, v: number) => v == null ? "" : fmtNum(v) });
    });

    try {
      freqInst.current = new (uPlot as any)(
        { width: el.offsetWidth || 800, height: 300, cursor: { show: true, drag: { setScale: true, x: true, y: false } }, legend: { show: true }, scales: { x: { time: false, distr: 3, log: 10, range: [1, 20000] } },
          axes: [
            { label: "Frequency (Hz)", grid: { stroke: "#f0f0f0" }, stroke: "#888", values: (_s: any, ticks: number[]) => ticks.map((t: number) => { const lg = Math.log10(t); return Math.abs(lg - Math.round(lg)) < 1e-10 ? fmtNum(t) : ""; }) },
            { stroke: "#888", grid: { stroke: "#f0f0f0" }, size: 85, values: (_s: any, ticks: number[]) => ticks.map((t: number) => fmtNum(t)) },
          ],
          series, hooks: { setCursor: [lbls.hook], setSelect: [makeSelectHandler("fft")] },
        },
        [freq.map((v: number | null) => (v != null ? v : null)), ...plots.map((p) => (p.data || []).slice(0, freq.length))], el,
      );
      const overEl = el.querySelector(".u-over") as HTMLElement | null;
      (overEl || el).addEventListener("dblclick", makeDblHandler("fft"));
    } catch { /* */ }
  }, [tasks, checked, makeSelectHandler, makeDblHandler]);

  // ── Resize / cleanup ──
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(timer); timer = setTimeout(() => setChecked((prev) => ({ ...prev })), 200); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); clearTimeout(timer); };
  }, []);

  useEffect(() => () => {
    timeLbls.current?.destroy(); freqLbls.current?.destroy();
    timeInst.current?.destroy(); freqInst.current?.destroy();
  }, []);

  // ── 预取共享轴 ──
  useEffect(() => {
    (async () => {
      const first = tasks.find((t) => t.status === "done");
      if (!first) return;
      if (first.cache.time === undefined) {
        const r = await getTaskSignals(first.id, ["time"], "time", undefined, undefined, false);
        const col = r.success && r.data ? r.data.columns.find((c: any) => c.name === "time") : undefined;
        setTasks((prev) => {
          const idx = prev.findIndex((t) => t.id === first.id); if (idx < 0) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], cache: { ...next[idx].cache, time: col ? col.data.map((v: any) => (isNil(v) ? null : Number(v))) as number[] | null : null } };
          return next;
        });
      }
      if (first.cache.frequency === undefined) {
        const r = await getTaskSignals(first.id, ["frequency"], "fft", undefined, undefined, true);
        const col = r.success && r.data ? r.data.columns.find((c: any) => c.name === "frequency") : undefined;
        setTasks((prev) => {
          const idx = prev.findIndex((t) => t.id === first.id); if (idx < 0) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], cache: { ...next[idx].cache, frequency: col ? col.data.map((v: any) => (isNil(v) ? null : Number(v))) as number[] | null : null } };
          return next;
        });
      }
    })();
  }, [tasks]);

  // ── SVG 导出 ──
  function exportSVG(container: HTMLDivElement | null, defaultName: string) {
    if (!container) return;
    const canvas = container.querySelector("canvas"); if (!canvas) return;
    const name = window.prompt("导出文件名:", defaultName); if (!name) return;
    const filename = name.endsWith(".svg") ? name : name + ".svg";
    const dataUrl = canvas.toDataURL("image/png");
    const blob = new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}"><image href="${dataUrl}" width="${canvas.width}" height="${canvas.height}"/></svg>`], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.download = filename; link.href = url; link.click();
    URL.revokeObjectURL(url);
  }

  // ── 派生值 ──
  const doneTasks = tasks.filter((t) => t.status === "done");
  const sigCount = doneTasks.reduce((n, t) => n + t.sigNames.length, 0);
  const title = ids.length > 1 ? `${ids.length} 个任务 (${ids.join(", ")})` : `任务 #${ids[0] || "?"}`;
  const exportBase = ids.length > 1 ? `data_${ids.join("_")}` : `data_task_${ids[0] || "x"}`;

  // ── 渲染 ──
  return (
    <>
      <style>{`
        .sig-sidebar::after { content:""; position:absolute; right:0; top:0; bottom:0; width:8px; cursor:col-resize; }
        .dv-chart .u-legend { position:absolute; top:4px; right:8px; z-index:10; font-size:11px; background:rgba(255,255,255,0.85); padding:4px 8px; border-radius:4px; }
        .uplot .u-cursor-pt { border-radius:50%!important; box-shadow:0 0 0 3px rgba(59,130,246,0.2)!important; }
        .ant-tabs.data-tabs { flex:1; display:flex; flex-direction:column; overflow:hidden; min-height:0; }
        .ant-tabs.data-tabs>.ant-tabs-nav { margin-bottom:0; padding:0 16px; background:#fff; border-bottom:1px solid #f0f0f0; }
        .ant-tabs.data-tabs>.ant-tabs-content-holder { flex:1; display:flex; flex-direction:column; overflow:hidden; min-height:0; }
        .ant-tabs.data-tabs>.ant-tabs-content-holder>.ant-tabs-content { flex:1; display:flex; flex-direction:column; min-height:0; }
        .ant-tabs.data-tabs .ant-tabs-tabpane-active { flex:1; display:flex; flex-direction:column; min-height:0; }
        .dense-table .ant-table-cell { padding: 2px 8px !important; line-height: 1.4; }
        .dense-table .ant-table-thead .ant-table-cell { padding: 4px 8px !important; }
      `}</style>
    <div className="h-[calc(100vh-49px)] flex flex-col p-4">
      <div className="flex items-center gap-4 mb-3">
        <h2 className="text-base font-semibold m-0">{title}</h2>
      </div>

      <Tabs
        className="data-tabs"
        onChange={(key) => {
          if (key === "perf") setPerfActive(true);
          if (key === "perf" && doneTasks.length > 0 && Object.keys(indicationData).length === 0) {
            setIndicationLoading(true);
            (async () => {
              const data: typeof indicationData = {};
              for (const t of doneTasks) {
                try {
                  const r = await getTaskIndication(t.id);
                  if (r.success && r.data) data[t.id] = r.data;
                } catch { /* */ }
              }
              setIndicationData(data);
              setIndicationLoading(false);
            })();
          }
        }}
        items={[
          {
            key: "data",
            label: "数据查看",
            children: (
              ids.length === 0 ? (
                <div className="text-center text-[#999] py-[120px] text-sm flex flex-col items-center gap-3">
                  <BarChartOutlined style={{ fontSize: 36, color: "#d0d5dd" }} />
                  <span>请从任务列表中选择任务查看数据</span>
                </div>
              ) : loading ? (
                <div style={{ textAlign: "center", padding: 120 }}><Spin size="large" /></div>
              ) : doneTasks.length === 0 ? (
                <div className="text-center text-[#999] py-[40px] text-sm flex flex-col items-center gap-3">
                  {tasks.some((t) => t.status !== "done") ? (
                    tasks.filter((t) => t.status !== "done").map((t) => (
                      <div key={t.id} className="rounded-lg border border-[#fee2e2] p-3 text-left max-w-md w-full" style={{ background: "#fef2f2" }}>
                        <div className="text-[#991b1b] font-semibold text-[13px] mb-1">{t.name} — {t.status === "failed" ? "执行失败" : t.status === "cancelled" ? "已取消" : t.status === "running" ? "运行中" : "等待中"}</div>
                        {t.error && <div className="text-[#991b1b]/70 text-xs">{t.error}</div>}
                      </div>
                    ))
                  ) : (
                    <span>所选任务暂无可查看的仿真数据</span>
                  )}
                </div>
              ) : (
                <>
                  {tasks.some((t) => t.status !== "done") && doneTasks.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {tasks.filter((t) => t.status !== "done").map((t) => (
                        <div key={t.id} className="rounded-full border border-[#fecaca] px-3 py-0.5 text-xs" style={{ background: "#fef2f2" }}>
                          <span className="text-[#991b1b] font-medium">{t.name}</span>
                          <span className="text-[#991b1b]/70 ml-1">
                            {t.status === "failed" ? "执行失败" : t.status === "cancelled" ? "已取消" : t.status === "running" ? "运行中" : "等待中"}
                            {t.error ? `：${t.error}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-1 gap-3 overflow-hidden min-h-0">
                    <div
                      className="sig-sidebar"
                      style={{ width: leftWidth, minWidth: 0, flexShrink: 0, position: "relative", border: "1px solid #f0f0f0", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", height: "100%" }}
                      onMouseDown={(e) => { if (e.nativeEvent.offsetX >= (e.currentTarget as HTMLElement).offsetWidth - 8) startResize(e); }}
                    >
                      <div className="flex items-center justify-between px-2.5 py-2 border-b border-[#f0f0f0] font-semibold text-[13px]" style={{ cursor: "default" }}>
                        <span>信号列表 ({sigCount})</span>
                        <div className="flex gap-1">
                          <Button size="small" onClick={toggleAllOff}>全不选</Button>
                          <Button size="small" loading={exporting} onClick={() => exportCSV()}>{exporting ? "导出中..." : "导出CSV"}</Button>
                        </div>
                      </div>
                      <div style={{ padding: "4px 8px" }}>
                        <Input placeholder="搜索信号..." value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear size="small" />
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-1.5" style={{ scrollbarGutter: "stable" }}>
                        {doneTasks.map((t) => {
                          const names = t.sigNames.filter((n) => n.toLowerCase().includes(searchText.toLowerCase()));
                          const open = searchText ? names.length > 0 : taskExpanded[t.id] === true;
                          return (
                            <div key={t.id} className="mb-2">
                              <div className="flex items-center gap-1 text-[13px] font-semibold py-1 cursor-pointer select-none" onClick={() => setTaskExpanded((p) => ({ ...p, [t.id]: !open }))}>
                                <span className="w-3 text-center text-[#999] shrink-0 text-[10px]">{open ? "▼︎" : "▶︎"}</span>
                                <span className="inline-block shrink-0" style={{ width: 8, height: 8, borderRadius: 1, background: "#3b82f6", transform: "rotate(45deg)" }} />
                                <span>{t.name}</span>
                                <span className="text-[#999] text-xs font-normal">({t.sigNames.length})</span>
                              </div>
                              {open && names.map((n) => {
                                const key = `${t.id}::${n}`, fftKey = `${t.id}::fft::${n}`;
                                return (
                                  <label key={key} className="flex items-center gap-1 cursor-pointer text-[13px] py-0.5 pl-3">
                                    <input type="checkbox" checked={checked[key] === true && checked[fftKey] === true}
                                      onChange={() => { toggle(key, t.id, n, "time"); toggle(fftKey, t.id, n, "fft"); }}
                                    />
                                    <span>{n}</span>
                                  </label>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto flex flex-col">
                      <div className="flex flex-col">
                        <div className="text-[13px] font-semibold text-[#555] mb-0.5 flex justify-between items-center">
                          时域图
                          <Button size="small" onClick={() => exportSVG(timeChartRef.current, `${exportBase}_time.svg`)}>导出SVG</Button>
                        </div>
                        <div ref={timeChartRef} className="dv-chart min-h-[300px] min-w-full relative" />
                      </div>
                      <div className="flex flex-col">
                        <div className="text-[13px] font-semibold text-[#555] mb-0.5 flex justify-between items-center">
                          频域图
                          <Button size="small" onClick={() => exportSVG(freqChartRef.current, `${exportBase}_freq.svg`)}>导出SVG</Button>
                        </div>
                        <div ref={freqChartRef} className="dv-chart min-h-[300px] min-w-full relative" />
                      </div>
                    </div>
                  </div>
                </>
              )
            ),
          },
          {
            key: "perf",
            label: "性能分析",
            children: !perfActive ? (
              <div className="flex-1 overflow-y-auto p-4"><div className="text-center text-[#999] py-20">性能分析功能开发中...</div></div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {ids.length === 0 ? (
                  <div className="text-center text-[#999] py-[120px] text-sm flex flex-col items-center gap-3">
                    <FundOutlined style={{ fontSize: 36, color: "#d0d5dd" }} />
                    <span>请从任务列表中选择任务进行指标分析</span>
                  </div>
                ) : doneTasks.length === 0 ? (
                  <div className="text-center text-[#999] py-20 text-sm">所选任务暂无可查看的仿真数据</div>
                ) : indicationLoading ? (
                  <div className="flex items-center justify-center py-20"><Spin size="large" /></div>
                ) : (
                  <div className="px-3 py-3 space-y-5">
                    {doneTasks.map((t) => {
                      const ind = indicationData[t.id];
                      return (
                        <div key={t.id}>
                          <h3 className="text-[13px] font-semibold text-[#555] mb-2">{t.name}</h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-[#f0f0f0] overflow-hidden">
                              <div className="bg-[#fafafa] px-3 py-1.5 text-[12px] font-semibold text-[#666] border-b border-[#f0f0f0]">RS 指标表</div>
                              <Table
                                size="small"
                                pagination={false}
                                className="text-[12px] dense-table"
                                tableLayout="auto"
                                dataSource={ind?.rs ? ind.rs.rows.map((row, i) => ({ ...Object.fromEntries(ind.rs!.headers.map((h, j) => [h, row[j] ?? ""])), _key: i })) : []}
                                columns={ind?.rs ? ind.rs.headers.map((h) => ({ title: h, dataIndex: h, key: h })) : []}
                                rowKey="_key"
                                bordered
                                locale={{ emptyText: <span className="text-[#999] text-xs">暂无 RS 指标数据</span> }}
                              />
                            </div>
                            <div className="rounded-lg border border-[#f0f0f0] overflow-hidden">
                              <div className="bg-[#fafafa] px-3 py-1.5 text-[12px] font-semibold text-[#666] border-b border-[#f0f0f0]">WS 指标表</div>
                              <Table
                                size="small"
                                pagination={false}
                                className="text-[12px] dense-table"
                                tableLayout="auto"
                                dataSource={ind?.ws ? ind.ws.rows.map((row, i) => ({ ...Object.fromEntries(ind.ws!.headers.map((h, j) => [h, row[j] ?? ""])), _key: i })) : []}
                                columns={ind?.ws ? ind.ws.headers.map((h) => ({ title: h, dataIndex: h, key: h })) : []}
                                rowKey="_key"
                                bordered
                                locale={{ emptyText: <span className="text-[#999] text-xs">暂无 WS 指标数据</span> }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
    </>
  );
}
