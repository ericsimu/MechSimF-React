import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { Button, Input, Spin } from "antd";
import { getTaskStatus, getTaskDataColumns, getTaskSignals } from "../api/index";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { isNil } from "../utils/isNil";

const COLORS = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f97316"];

function fmtNum(v: number): string {
  if (!isFinite(v)) return String(v);
  const av = Math.abs(v);
  if (av === 0) return "0";
  if (av < 0.001 || av >= 10000) return v.toExponential(4);
  const s = v.toFixed(10);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

type Cursors = { hook: (u: any) => void; destroy: () => void };
function makeCursorLabels(container: HTMLElement, xUnit: string): Cursors {
  const labels: HTMLDivElement[] = [];
  const removeAll = () => { labels.forEach((l) => l.remove()); labels.length = 0; };
  const onLeave = () => removeAll();
  container.addEventListener("mouseleave", onLeave);
  return {
    hook(u: any) {
      try {
        removeAll();
        const idx = u.cursor?.idx;
        if (isNil(idx)) return;
        const xVal = u.data[0][idx];
        const xLeft = u.valToPos(xVal, "x");
        const xl = document.createElement("div");
        xl.style.cssText = `position:absolute;left:${xLeft + 4}px;bottom:22px;font-size:10px;color:#fff;background:rgba(0,0,0,0.72);padding:1px 4px;border-radius:2px;pointer-events:none;white-space:nowrap;z-index:100;`;
        xl.textContent = `${fmtNum(xVal)} ${xUnit}`;
        container.appendChild(xl); labels.push(xl);
        for (let i = 1; i < u.series.length; i++) {
          const y = u.data[i]?.[idx];
          if (isNil(y)) continue;
          const d = document.createElement("div");
          d.style.cssText = `position:absolute;left:${xLeft + 6}px;top:${u.valToPos(y,"y") - 14}px;font-size:10px;color:#fff;background:rgba(0,0,0,0.78);padding:1px 5px;border-radius:2px;border-left:2px solid ${u.series[i].stroke || "#888"};pointer-events:none;white-space:nowrap;z-index:100;line-height:1.5;`;
          d.textContent = `${u.series[i].label || ""}:${fmtNum(y)}`;
          container.appendChild(d); labels.push(d);
        }
      } catch { /* keep cursor working */ }
    },
    destroy() { removeAll(); container.removeEventListener("mouseleave", onLeave); },
  };
}

type TaskInfo = {
  id: number; name: string; status: string;
  sigNames: string[]; fftNames: string[];
  cache: Record<string, number[] | null>;
};

/** 数据查看页：/data?ids=1,2,3（支持单/多任务数据查看） */
export default function DataViewer() {
  const location = useLocation();
  const history = useHistory();
  const ids = useMemo(
    () => (new URLSearchParams(location.search).get("ids") || "")
      .split(",").map((s) => Number(s)).filter((n) => !isNaN(n) && n > 0),
    [location.search],
  );

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState("");
  const [taskExpanded, setTaskExpanded] = useState<Record<number, boolean>>({});

  const timeChartRef = useRef<HTMLDivElement>(null);
  const freqChartRef = useRef<HTMLDivElement>(null);
  const timeInst = useRef<any>(null);
  const freqInst = useRef<any>(null);
  const timeLbls = useRef<Cursors | null>(null);
  const freqLbls = useRef<Cursors | null>(null);

  // 加载各任务
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
          let sigNames: string[] = [];
          let fftNames: string[] = [];
          if (status === "done") {
            const cr = await getTaskDataColumns(id);
            if (cr.success && cr.data) {
              sigNames = (cr.data.column_names || []).filter((n: string) => n.toLowerCase() !== "time");
              fftNames = (cr.data.fft_column_names || []).filter((n: string) => n.toLowerCase() !== "frequency");
            }
          }
          results.push({ id, name: `任务#${id}`, status, sigNames, fftNames, cache: {} });
        } catch {
          results.push({ id, name: `任务#${id}`, status: "failed", sigNames: [], fftNames: [], cache: {} });
        }
      }
      if (!cancelled) { setTasks(results); setChecked({}); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [ids]);

  // 拉取单个信号
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

  function toggle(key: string, taskId: number, sigName: string, domain: "time" | "fft") {
    const newVal = !checked[key];
    setChecked((prev) => ({ ...prev, [key]: newVal }));
    if (newVal) fetchOne(taskId, sigName, domain);
  }

  function toggleAllOff() { setChecked({}); }

  // 时域图
  useEffect(() => {
    if (timeLbls.current) { timeLbls.current.destroy(); timeLbls.current = null; }
    if (timeInst.current) { timeInst.current.destroy(); timeInst.current = null; }
    const el = timeChartRef.current; if (!el) return;

    type Plot = { label: string; color: string; data: number[] | null };
    const plots: Plot[] = [];
    Object.entries(checked).filter(([k, v]) => v && !k.includes("::fft::")).forEach(([k]) => {
      const [tidStr, sigName] = k.split("::");
      const tt = tasks.find((t) => t.id === Number(tidStr));
      if (!tt) return;
      plots.push({ label: `${tt.name}/${sigName}`, color: COLORS[tasks.findIndex((t) => t.id === tt.id) % COLORS.length], data: tt.cache[sigName] ?? null });
    });
    if (plots.length === 0) return;

    const xTask = tasks.find((t) => t.cache["time"] && (t.cache["time"] as number[]).length > 0);
    const maxLen = plots.reduce((m, p) => p.data ? Math.max(m, p.data.length) : m, 0);
    const xAxis: number[] = xTask ? (xTask.cache["time"] as number[]).slice(0, maxLen) : Array.from({ length: maxLen }, (_, i) => i);

    const lbls = makeCursorLabels(el, "s"); timeLbls.current = lbls;
    const series: Array<object> = [{ label: xTask ? "Time (s)" : "Index" }];
    const arrays: Array<Array<number | null>> = [];
    plots.forEach((p) => {
      series.push({ label: p.label, stroke: p.color, width: 1.5, value: (_u: unknown, v: number) => v == null ? "" : fmtNum(v) });
      arrays.push((p.data || []).slice(0, maxLen).map((v) => (v == null ? null : v)));
    });

    try {
      timeInst.current = new (uPlot as any)(
        { width: el.offsetWidth || 800, height: 300, cursor: { show: true }, legend: { show: true }, scales: { x: { time: false } },
          axes: [
            { label: xTask ? "Time (s)" : "Index", grid: { stroke: "#e8e8e8" }, stroke: "#888", values: (_s: any, ticks: number[]) => ticks.map((t: number) => fmtNum(t) + " s") },
            { stroke: "#888", grid: { stroke: "#e8e8e8" }, values: (_s: any, ticks: number[]) => ticks.map((t: number) => fmtNum(t)) },
          ],
          series, hooks: { setCursor: [lbls.hook] },
        },
        [xAxis, ...arrays], el,
      );
    } catch { /* */ }
  }, [tasks, checked]);

  // 频域图
  useEffect(() => {
    if (freqLbls.current) { freqLbls.current.destroy(); freqLbls.current = null; }
    if (freqInst.current) { freqInst.current.destroy(); freqInst.current = null; }
    const el = freqChartRef.current; if (!el) return;

    type Plot = { label: string; color: string; data: number[] | null };
    const plots: Plot[] = [];
    Object.entries(checked).filter(([k, v]) => v && k.includes("::fft::")).forEach(([k]) => {
      const m = k.match(/^(\d+)::fft::(.+)$/); if (!m) return;
      const tt = tasks.find((t) => t.id === Number(m[1]));
      if (!tt) return;
      plots.push({ label: `${tt.name}/${m[2]}`, color: COLORS[tasks.findIndex((t) => t.id === tt.id) % COLORS.length], data: tt.cache[`fft::${m[2]}`] ?? null });
    });
    if (plots.length === 0) return;

    const xTask = tasks.find((t) => t.cache["frequency"] && (t.cache["frequency"] as number[]).length > 0);
    if (!xTask) return;
    const freq = xTask.cache["frequency"] as number[];

    const lbls = makeCursorLabels(el, ""); freqLbls.current = lbls;
    const series: Array<object> = [{ label: "Frequency (Hz)" }];
    plots.forEach((p) => {
      series.push({ label: p.label, stroke: p.color, width: 1.5, value: (_u: unknown, v: number) => v == null ? "" : fmtNum(v) });
    });

    try {
      freqInst.current = new (uPlot as any)(
        { width: el.offsetWidth || 800, height: 300, cursor: { show: true }, legend: { show: true }, scales: { x: { time: false, distr: 3, log: 10, range: [1, 20000] } },
          axes: [
            { label: "Frequency (Hz)", grid: { stroke: "#e8e8e8" }, stroke: "#888", values: (_s: any, ticks: number[]) => ticks.map((t: number) => { const lg = Math.log10(t); return Math.abs(lg - Math.round(lg)) < 1e-10 ? fmtNum(t) : ""; }) },
            { stroke: "#888", grid: { stroke: "#e8e8e8" }, values: (_s: any, ticks: number[]) => ticks.map((t: number) => fmtNum(t)) },
          ],
          series, hooks: { setCursor: [lbls.hook] },
        },
        [freq.map((v: number | null) => (v != null ? v : null)), ...plots.map((p) => (p.data || []).slice(0, freq.length))], el,
      );
    } catch { /* */ }
  }, [tasks, checked]);

  // Resize
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(timer); timer = setTimeout(() => setChecked((prev) => ({ ...prev })), 200); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); clearTimeout(timer); };
  }, []);

  useEffect(() => () => {
    if (timeLbls.current) timeLbls.current.destroy();
    if (freqLbls.current) freqLbls.current.destroy();
    if (timeInst.current) timeInst.current.destroy();
    if (freqInst.current) freqInst.current.destroy();
  }, []);

  // 预取首个 done 任务的 time/frequency
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

  const doneTasks = tasks.filter((t) => t.status === "done");
  const sigCount = doneTasks.reduce((n, t) => n + t.sigNames.length, 0);
  const title = ids.length > 1 ? `数据查看 — ${ids.length} 个任务 (${ids.join(", ")})` : `数据查看 — 任务 #${ids[0] || "?"}`;
  const exportBase = ids.length > 1 ? `data_${ids.join("_")}` : `data_task_${ids[0] || "x"}`;

  return (
    <div className="h-[calc(100vh-49px)] flex flex-col p-4">
      <div className="flex items-center gap-4 mb-3">
        <Button onClick={() => history.goBack()}>返回</Button>
        <h2 className="text-base font-semibold m-0">{title}</h2>
      </div>

      {ids.length === 0 ? (
        <div className="text-center text-[#999] py-[120px] text-sm">请从任务列表中选择一个任务查看数据</div>
      ) : loading ? (
        <div style={{ textAlign: "center", padding: 120 }}><Spin size="large" /></div>
      ) : doneTasks.length === 0 ? (
        <div className="text-center text-[#999] py-[120px] text-sm">所选任务暂无可查看的仿真数据</div>
      ) : (
        <div className="flex flex-1 gap-3 overflow-hidden">
          <div className="w-[260px] shrink-0 border border-[#e8e8e8] rounded-md flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-2.5 py-2 border-b border-[#e8e8e8] font-semibold text-[13px]">
              <span>信号列表 ({sigCount})</span>
              <Button size="small" onClick={toggleAllOff}>全不选</Button>
            </div>
            <div style={{ padding: "4px 8px" }}>
              <Input placeholder="搜索信号..." value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear size="small" />
            </div>
            <div className="flex-1 overflow-y-auto px-2.5 py-1.5">
              {doneTasks.map((t) => {
                const ti = tasks.findIndex((x) => x.id === t.id);
                const color = COLORS[ti % COLORS.length];
                const names = t.sigNames.filter((n) => n.toLowerCase().includes(searchText.toLowerCase()));
                const open = taskExpanded[t.id] === true;
                return (
                  <div key={t.id} className="mb-2">
                    <div className="flex items-center gap-1 text-[13px] font-semibold py-1 cursor-pointer select-none" onClick={() => setTaskExpanded((p) => ({ ...p, [t.id]: !open }))}>
                      <span className="w-3 text-center text-[#999] shrink-0 text-[10px]">{open ? "▼︎" : "▶︎"}</span>
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      <span>{t.name}</span>
                      <span className="text-[#999] text-xs font-normal">({t.sigNames.length})</span>
                    </div>
                    {open && names.map((n) => {
                      const key = `${t.id}::${n}`;
                      const fftKey = `${t.id}::fft::${n}`;
                      return (
                        <label key={key} className="flex items-center gap-1 cursor-pointer text-[13px] py-0.5 pl-3">
                          <input type="checkbox" checked={checked[key] === true && checked[fftKey] === true}
                            onChange={() => {
                              toggle(key, t.id, n, "time");
                              toggle(fftKey, t.id, n, "fft");
                            }}
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
      )}
    </div>
  );
}
