import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Input, Spin } from "antd";
import {
  getTaskDataColumns,
  getTaskSignals,
  getTaskStatus,
} from "../api/index";
import type { DisturbanceColumn } from "../types/api";
import uPlot from "uplot/dist/uPlot.esm.js";
import "uplot/dist/uPlot.min.css";
import { isNil } from "../utils/isNil";
import "./DataViewer.css";

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#6366f1",
];

const STATUS_MAP: Record<string, string> = {
  pending: "等待中",
  running: "运行中",
  done: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

function fmtNum(v: number): string {
  if (!isFinite(v)) return String(v);
  const av = Math.abs(v);
  if (av === 0) return "0";
  if (av < 0.001 || av >= 10000) return v.toExponential(4);
  const s = v.toFixed(10);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}


type CursorLabels = {
  hook: (u: any) => void;
  destroy: () => void;
};

function makeCursorLabels(
  container: HTMLElement,
  xUnit: string,
  yFmt: (v: number) => string = fmtNum,
): CursorLabels {
  const labels: HTMLDivElement[] = [];
  function removeAll() {
    labels.forEach((l) => l.remove());
    labels.length = 0;
  }
  function onLeave() {
    removeAll();
  }
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
        container.appendChild(xl);
        labels.push(xl);
        for (let i = 1; i < u.series.length; i++) {
          const y = u.data[i]?.[idx];
          if (isNil(y)) continue;
          const ly = u.valToPos(xVal, "x");
          const ty = u.valToPos(y, "y");
          const d = document.createElement("div");
          d.style.cssText = `position:absolute;left:${ly + 6}px;top:${ty - 14}px;font-size:10px;color:#fff;background:rgba(0,0,0,0.78);padding:1px 5px;border-radius:2px;border-left:2px solid ${u.series[i].stroke || "#888"};pointer-events:none;white-space:nowrap;z-index:100;line-height:1.5;`;
          d.textContent = `${u.series[i].label || ""}:${yFmt(y)}`;
          container.appendChild(d);
          labels.push(d);
        }
      } catch {
        /* keep cursor working */
      }
    },
    destroy() {
      removeAll();
      container.removeEventListener("mouseleave", onLeave);
    },
  };
}

const DataViewer: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const tid = Number(taskId);

  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<DisturbanceColumn[]>([]);
  const [fftColumns, setFftColumns] = useState<DisturbanceColumn[]>([]);
  const [taskStatus, setTaskStatus] = useState("");
  const [taskError, setTaskError] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState("");

  // Zoom state
  const [isTimeZoomed, setIsTimeZoomed] = useState(false);
  const [isFreqZoomed, setIsFreqZoomed] = useState(false);
  const fullColumns = useRef<DisturbanceColumn[] | null>(null);
  const fullFftColumns = useRef<DisturbanceColumn[] | null>(null);
  const timeBuildAt = useRef(0);
  const freqBuildAt = useRef(0);

  const timeChartRef = useRef<HTMLDivElement>(null);
  const freqChartRef = useRef<HTMLDivElement>(null);
  const timeInst = useRef<any>(null);
  const freqInst = useRef<any>(null);
  const timeDblCleanup = useRef<(() => void) | null>(null);
  const freqDblCleanup = useRef<(() => void) | null>(null);
  const timeLabels = useRef<CursorLabels | null>(null);
  const freqLabels = useRef<CursorLabels | null>(null);

  const columnsRef = useRef(columns);


  columnsRef.current = columns;
  const fftColumnsRef = useRef(fftColumns);


  fftColumnsRef.current = fftColumns;
  const checkedRef = useRef(checked);


  checkedRef.current = checked;
  const isTimeZoomedRef = useRef(isTimeZoomed);


  isTimeZoomedRef.current = isTimeZoomed;
  const isFreqZoomedRef = useRef(isFreqZoomed);


  isFreqZoomedRef.current = isFreqZoomed;

  async function fetchSignals(
    names: string[],
    domain: "time" | "fft",
    start?: number,
    end?: number,
  ) {
    const target =
      domain === "fft" ? fftColumnsRef.current : columnsRef.current;
    const setTarget = domain === "fft" ? setFftColumns : setColumns;
    const isZoomed =
      domain === "fft" ? isFreqZoomedRef.current : isTimeZoomedRef.current;

    let rangeStart = start;
    let rangeEnd = end;
    let hasRange = !isNil(rangeStart) && !isNil(rangeEnd);
    if (!hasRange && domain === "time" && isZoomed) {
      const timeCol = target.find((c) => c.name.toLowerCase() === "time");
      if (timeCol && timeCol.data.length > 0) {
        const d = timeCol.data;
        rangeStart = d[0] ?? undefined;
        rangeEnd = d[d.length - 1] ?? undefined;
        hasRange = !isNil(rangeStart) && !isNil(rangeEnd);
      }
    }

    let toFetch: string[];
    if (hasRange) {
      toFetch = [...names];
    } else {
      toFetch = names.filter((n) => {
        const col = target.find((c) => c.name === n);
        return col && col.data.length === 0;
      });
      if (toFetch.length === 0) return;
    }

    const xName = domain === "fft" ? "frequency" : "time";
    const xCol = target.find((c) => c.name.toLowerCase() === xName);
    if (xCol && xCol.data.length === 0 && !toFetch.includes(xCol.name))
      toFetch.push(xCol.name);

    const raw = domain === "fft" || (hasRange && rangeEnd! - rangeStart! < 1.0);
    try {
      const r = await getTaskSignals(
        tid,
        toFetch,
        domain,
        rangeStart,
        rangeEnd,
        raw,
      );
      if (r.success && r.data) {
        setTarget((prev) => {
          const updated = [...prev];
          for (const sc of r.data!.columns) {
            if (
              sc.name.toLowerCase() === xName &&
              !toFetch.some((n) => n.toLowerCase() === xName)
            )
              continue;
            const idx = updated.findIndex((c) => c.name === sc.name);
            if (idx >= 0) updated[idx] = { ...updated[idx], data: sc.data };
          }
          return updated;
        });
      }
    } catch {
      /* */
    }
  }

  const toggleChecked = useCallback(
    (name: string) => {
      const newVal = !checkedRef.current[name];
      setChecked((prev) => ({ ...prev, [name]: newVal }));
      if (newVal) {
        fetchSignals([name], "time");
        fetchSignals([name], "fft");
      }
    },
    [tid],
  );

  function toggleAllOff() {
    setChecked({});
  }

  function exportChartSVG(
    container: HTMLDivElement | null,
    inst: any,
    defaultName: string,
  ) {
    if (!container) return;
    const canvas = container.querySelector("canvas");
    if (!canvas) return;
    const name = window.prompt("导出文件名:", defaultName);
    if (!name) return;
    const filename = name.endsWith(".svg") ? name : name + ".svg";
    const dataUrl = canvas.toDataURL("image/png");
    const cw = canvas.width;
    const ch = canvas.height;
    // Build legend from uPlot instance series data (exact colors)
    let legendSvg = "";
    let legendH = 0;
    if (inst && inst.series) {
      const active = inst.series.slice(1).filter((s: any) => s.show !== false);
      if (active.length > 0) {
        const itemH = 18;
        legendH = active.length * itemH + 10;
        legendSvg = `<rect x="0" y="${ch}" width="${cw}" height="${legendH}" fill="#fafafa" stroke="#e8e8e8" stroke-width="1"/>`;
        active.forEach((s: any, i: number) => {
          const color = s.stroke || s.fill || "#888";
          const label = (s.label || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          const y = ch + 8 + i * itemH;
          legendSvg += `<rect x="8" y="${y}" width="10" height="10" fill="${color}" rx="2"/>`;
          legendSvg += `<text x="24" y="${y + 10}" font-size="11" fill="#333" font-family="sans-serif">${label}</text>`;
        });
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch + legendH}"><image href="${dataUrl}" width="${cw}" height="${ch}"/>${legendSvg}</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Zoom-in handler (drag-to-zoom)
  const makeSelectHandler = useCallback(
    (domain: "time" | "fft") => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let pending: { start: number; end: number } | null = null;
      return (u: any) => {
        const buildAt =
          domain === "time" ? timeBuildAt.current : freqBuildAt.current;
        if (Date.now() - buildAt < 500) return;
        if (u.select && u.select.width > 5) {
          const xMin = u.posToVal(u.select.left, "x");
          const xMax = u.posToVal(u.select.left + u.select.width, "x");
          pending = { start: Math.min(xMin, xMax), end: Math.max(xMin, xMax) };
        }
        if (timer) clearTimeout(timer);
        timer = setTimeout(async () => {
          if (!pending) return;
          const rng = pending;
          pending = null;
          const zoomed =
            domain === "time"
              ? isTimeZoomedRef.current
              : isFreqZoomedRef.current;
          const target =
            domain === "fft" ? fftColumnsRef.current : columnsRef.current;
          if (!zoomed) {
            if (domain === "time")
              fullColumns.current = target.map((c) => ({
                name: c.name,
                data: [...c.data],
              }));
            else
              fullFftColumns.current = target.map((c) => ({
                name: c.name,
                data: [...c.data],
              }));
          }
          const sigs: string[] = u.series
            .slice(1)
            .map((s: any) => s.label)
            .filter(Boolean);
          if (sigs.length === 0) return;
          const xName = domain === "fft" ? "frequency" : "time";
          const zoomRange = rng.end - rng.start;
          const raw = domain === "fft" || zoomRange < 1.0;
          const r = await getTaskSignals(
            tid,
            [xName, ...sigs],
            domain,
            rng.start,
            rng.end,
            raw,
          );
          if (r.success && r.data) {
            const setTarget = domain === "fft" ? setFftColumns : setColumns;
            setTarget((prev) => {
              const updated = [...prev];
              for (const sc of r.data!.columns) {
                const idx = updated.findIndex((c) => c.name === sc.name);
                if (idx >= 0) updated[idx] = { ...updated[idx], data: sc.data };
              }
              return updated;
            });
            if (domain === "time") {
              setIsTimeZoomed(true);
              isTimeZoomedRef.current = true;
            } else {
              setIsFreqZoomed(true);
              isFreqZoomedRef.current = true;
            }
          }
        }, 200);
      };
    },
    [tid],
  );

  // Zoom-out restore (double-click)
  const restoreZoom = useCallback(
    (domain: "time" | "fft") => {
      const zoomed =
        domain === "time" ? isTimeZoomedRef.current : isFreqZoomedRef.current;
      const full =
        domain === "time" ? fullColumns.current : fullFftColumns.current;
      if (!zoomed || !full) return;

      if (domain === "time") {
        fullColumns.current = null;
        setIsTimeZoomed(false);
        isTimeZoomedRef.current = false;
        timeBuildAt.current = Date.now();
        const checkedNames = Object.keys(checkedRef.current).filter(
          (k) => checkedRef.current[k],
        );
        if (checkedNames.length > 0) {
          // Sync-clear ref so fetchSignals sees empty data immediately (matching Vue behavior)
          for (const name of checkedNames) {
            const col = columnsRef.current.find((c) => c.name === name);
            if (col) col.data = [];
          }
          const timeCol = columnsRef.current.find(
            (c) => c.name.toLowerCase() === "time",
          );
          if (timeCol) timeCol.data = [];
          setColumns([...columnsRef.current]);
          fetchSignals(checkedNames, "time");
        }
      } else {
        fullFftColumns.current = null;
        setIsFreqZoomed(false);
        isFreqZoomedRef.current = false;
        freqBuildAt.current = Date.now();
        const checkedNames = Object.keys(checkedRef.current).filter(
          (k) => checkedRef.current[k],
        );
        if (checkedNames.length > 0) {
          for (const name of checkedNames) {
            const col = fftColumnsRef.current.find((c) => c.name === name);
            if (col) col.data = [];
          }
          const freqCol = fftColumnsRef.current.find(
            (c) => c.name.toLowerCase() === "frequency",
          );
          if (freqCol) freqCol.data = [];
          setFftColumns([...fftColumnsRef.current]);
          fetchSignals(checkedNames, "fft");
        }
      }
    },
    [tid],
  );

  useEffect(() => {
    if (isNaN(tid)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getTaskStatus(tid)
      .then((statusR) => {
        if (statusR.success && statusR.data) {
          setTaskStatus(statusR.data.status || "");
          setTaskError(statusR.data.error || "");
        }
        // For done tasks, also fetch columns
        if (statusR.success && statusR.data && statusR.data.status === "done") {
          return getTaskDataColumns(tid).then((colsR) => {
            if (colsR.success && colsR.data) {
              setColumns([
                { name: "time", data: [] },
                ...colsR.data.column_names.map((n: string) => ({
                  name: n,
                  data: [],
                })),
              ]);
              setFftColumns([
                { name: "frequency", data: [] },
                ...(colsR.data.fft_column_names || []).map((n: string) => ({
                  name: n,
                  data: [],
                })),
              ]);
              setChecked({});
            }
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tid]);

  // Build time-domain chart
  useEffect(() => {
    if (timeDblCleanup.current) {
      timeDblCleanup.current();
      timeDblCleanup.current = null;
    }
    if (timeLabels.current) {
      timeLabels.current.destroy();
      timeLabels.current = null;
    }
    if (timeInst.current) {
      timeInst.current.destroy();
      timeInst.current = null;
    }

    const el = timeChartRef.current;
    if (!el || columns.length === 0) return;
    const timeCol = columns.find((c) => c.name.toLowerCase() === "time");
    const activeSigs = columns.filter(
      (c) =>
        c.name.toLowerCase() !== "time" &&
        checked[c.name] === true &&
        c.data.length > 0,
    );
    if (activeSigs.length === 0) return;

    const timeLen =
      timeCol && timeCol.data.length > 0
        ? timeCol.data.length
        : activeSigs[0].data.length;
    const timeDataArr =
      timeCol && timeCol.data.length > 0
        ? timeCol.data.map((v) => v ?? 0)
        : activeSigs[0].data.map((_, i) => i);
    const w = el.offsetWidth || 800;
    const labels = makeCursorLabels(el, "s", fmtNum);
    timeLabels.current = labels;

    const series: Array<object> = [{ label: timeCol ? "Time (s)" : "Index", value: (_u: unknown, v: number) => fmtNum(v) }];
    const signalArrays: Array<Array<number | null>> = [];
    for (const c of activeSigs) {
      const ci = columns.findIndex((sc) => sc.name === c.name);
      series.push({
        label: c.name,
        stroke: COLORS[ci >= 0 ? ci % COLORS.length : 0],
        width: 1.5,
        value: (_u: unknown, v: number) => v == null ? "" : fmtNum(v),
      });
      const mapped = c.data.map((v) => (isNil(v) ? null : Number(v)));
      signalArrays.push(
        mapped.length !== timeLen ? mapped.slice(0, timeLen) : mapped,
      );
    }

    try {
      timeBuildAt.current = Date.now();
      timeInst.current = new (uPlot as any)(
        {
          width: w,
          height: 300,
          cursor: { show: true, drag: { setScale: true, x: true, y: false } },
          legend: { show: true },
          scales: { x: { time: false } },
          axes: [
            {
              label: timeCol ? "Time (s)" : "Index",
              grid: { stroke: "#e8e8e8" },
              stroke: "#888",
              values: (_self: any, ticks: number[]) =>
                ticks.map((t) => fmtNum(t) + " s"),
            },
            {
              stroke: "#888",
              grid: { stroke: "#e8e8e8" },
            },
          ],
          series,
          hooks: {
            setCursor: [labels.hook],
            setSelect: [makeSelectHandler("time")],
          },
        },
        [timeDataArr, ...signalArrays],
        el,
      );
      const dblHandler = () => restoreZoom("time");
      const overEl = el.querySelector(".u-over") as HTMLElement | null;
      if (overEl) {
        overEl.addEventListener("dblclick", dblHandler);
        timeDblCleanup.current = () =>
          overEl.removeEventListener("dblclick", dblHandler);
      } else {
        el.addEventListener("dblclick", dblHandler);
        timeDblCleanup.current = () =>
          el.removeEventListener("dblclick", dblHandler);
      }
    } catch (e) {
      console.error("buildTimeChart failed:", e);
      timeInst.current = null;
    }
  }, [columns, checked, makeSelectHandler, restoreZoom]);

  // Build freq-domain chart
  useEffect(() => {
    if (freqDblCleanup.current) {
      freqDblCleanup.current();
      freqDblCleanup.current = null;
    }
    if (freqLabels.current) {
      freqLabels.current.destroy();
      freqLabels.current = null;
    }
    if (freqInst.current) {
      freqInst.current.destroy();
      freqInst.current = null;
    }

    const el = freqChartRef.current;
    if (!el || fftColumns.length === 0) return;
    const freqCol = fftColumns.find(
      (c) => c.name.toLowerCase() === "frequency",
    );
    const activeSigs = fftColumns.filter(
      (c) =>
        c.name.toLowerCase() !== "frequency" &&
        checked[c.name] === true &&
        c.data.length > 0,
    );
    if (activeSigs.length === 0 || !freqCol || freqCol.data.length === 0)
      return;

    const w = el.offsetWidth || 800;
    const labels = makeCursorLabels(el, "");
    freqLabels.current = labels;

    const series: Array<object> = [{ label: "Frequency (Hz)", value: (_u: unknown, v: number) => fmtNum(v) }];
    activeSigs.forEach((c) => {
      const ci = columns.findIndex((sc) => sc.name === c.name);
      series.push({
        label: c.name,
        stroke: COLORS[ci >= 0 ? ci % COLORS.length : 0],
        width: 1.5,
        value: (_u: unknown, v: number) => v == null ? "" : fmtNum(v),
      });
    });

    freqBuildAt.current = Date.now();
    freqInst.current = new (uPlot as any)(
      {
        width: w,
        height: 300,
        cursor: { show: true, drag: { setScale: true, x: true, y: false } },
        legend: { show: true },
        scales: { x: { time: false, distr: 3, log: 10 } },
        axes: [
          {
            label: "Frequency (Hz)",
            grid: { stroke: "#e8e8e8" },
            stroke: "#888",
            values: (_self: any, ticks: number[]) =>
              ticks.map((t) => fmtNum(t)),
          },
          { stroke: "#888", grid: { stroke: "#e8e8e8" } },
        ],
        series,
        hooks: {
          setCursor: [labels.hook],
          setSelect: [makeSelectHandler("fft")],
        },
      },
      [
        freqCol.data.map((v) => v ?? 0),
        ...activeSigs.map((c) =>
          c.data.map((v) => (isNil(v) ? null : Number(v))),
        ),
      ],
      el,
    );
    const dblHandler = () => restoreZoom("fft");
    const overEl = el.querySelector(".u-over") as HTMLElement | null;
    if (overEl) {
      overEl.addEventListener("dblclick", dblHandler);
      freqDblCleanup.current = () =>
        overEl.removeEventListener("dblclick", dblHandler);
    } else {
      el.addEventListener("dblclick", dblHandler);
      freqDblCleanup.current = () =>
        el.removeEventListener("dblclick", dblHandler);
    }
  }, [fftColumns, checked, makeSelectHandler, restoreZoom]);

  // Resize
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function onResize() {
      clearTimeout(timer);
      timer = setTimeout(() => setChecked((prev) => ({ ...prev })), 200);
    }
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, []);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (timeDblCleanup.current) timeDblCleanup.current();
      if (freqDblCleanup.current) freqDblCleanup.current();
      if (timeLabels.current) timeLabels.current.destroy();
      if (freqLabels.current) freqLabels.current.destroy();
      if (timeInst.current) timeInst.current.destroy();
      if (freqInst.current) freqInst.current.destroy();
    },
    [],
  );

  const sigCols = columns.filter((c) => c.name.toLowerCase() !== "time");
  const filteredSigCols = sigCols.filter((c) =>
    c.name.toLowerCase().includes(searchText.toLowerCase()),
  );

  return (
    <div className="dataviewer-page">
      <div className="dv-header">
        <Button onClick={() => navigate(-1)}>返回</Button>
        <h2>数据查看{!isNaN(tid) ? ` — 任务 #${tid}` : ""}</h2>
        {taskStatus && (
          <span className={`dv-status status-${taskStatus}`}>
            {STATUS_MAP[taskStatus] || taskStatus}
          </span>
        )}
      </div>

      {isNaN(tid) ? (
        <div className="dv-empty">请从任务列表中选择一个任务查看数据</div>
      ) : taskStatus === "cancelled" ? (
        <div className="dv-empty">该任务已被取消，无仿真数据</div>
      ) : taskStatus === "failed" ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#ef4444",
              marginBottom: 16,
            }}
          >
            任务执行失败
          </div>
          <div style={{ fontSize: 13, color: "#666" }}>
            失败原因：{taskError || "未知错误"}
          </div>
        </div>
      ) : loading ? (
        <div style={{ textAlign: "center", padding: 120 }}>
          <Spin size="large" />
        </div>
      ) : columns.length === 0 ? (
        <div className="dv-empty">该任务暂无输出数据</div>
      ) : (
        <div className="dv-body">
          <div className="dv-left">
            <div className="dv-signal-header">
              <span>信号列表 ({sigCols.length})</span>
              <Button size="small" onClick={toggleAllOff}>
                全不选
              </Button>
            </div>
            <div style={{ padding: "4px 8px" }}>
              <Input
                placeholder="搜索信号..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                size="small"
              />
            </div>
            <div className="dv-signal-list">
              {filteredSigCols.map((c) => (
                <label key={c.name} className="dv-signal-row">
                  <input
                    type="checkbox"
                    checked={checked[c.name] === true}
                    onChange={() => toggleChecked(c.name)}
                  />
                  <span className="dv-signal-name">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="dv-right">
            <div className="dv-chart-section">
              <div className="dv-chart-title">
                时域图
                <Button
                  size="small"
                  onClick={() =>
                    exportChartSVG(
                      timeChartRef.current,
                      timeInst.current,
                      `task_${tid}_time.svg`,
                    )
                  }
                >
                  导出SVG
                </Button>
              </div>
              <div ref={timeChartRef} className="dv-chart" />
            </div>
            <div className="dv-chart-section">
              <div className="dv-chart-title">
                频域图
                <Button
                  size="small"
                  onClick={() =>
                    exportChartSVG(
                      freqChartRef.current,
                      freqInst.current,
                      `task_${tid}_freq.svg`,
                    )
                  }
                >
                  导出SVG
                </Button>
              </div>
              <div ref={freqChartRef} className="dv-chart" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataViewer;
