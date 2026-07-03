import { useState, useEffect, useRef } from "react";
import { queueDisturbances, getDisturbanceInfo } from "@/api/index";
import { isNil } from "@/utils/isNil";
import DistTreeNode from "@/components/DistTreeNode";
import type { DisturbanceDirNode, DisturbanceColumn, ModelInfoMap } from "@/types/api";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { Spin } from "antd";
import { StockOutlined, ControlOutlined, FundOutlined } from "@ant-design/icons";

// ── 数值格式化（保留全精度） ──
function fmtNum(v: number): string {
  if (!isFinite(v)) return String(v);
  return String(v);
}

// ── 光标标签 ──
type Cursors = { hook: (u: any) => void; destroy: () => void };
function makeCursorLabels(container: HTMLElement): Cursors {
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
        xl.style.cssText = `position:absolute;left:${xLeft + 4}px;bottom:22px;font-size:10px;color:#333;background:rgba(255,255,255,0.9);padding:1px 4px;border-radius:2px;pointer-events:none;white-space:nowrap;z-index:100;`;
        xl.textContent = `${fmtNum(xVal)}`;
        container.appendChild(xl); labels.push(xl);
        for (let i = 1; i < u.series.length; i++) {
          if (u.series[i].show === false) continue;
          const y = u.data[i]?.[idx];
          if (isNil(y)) continue;
          const d = document.createElement("div");
          d.style.cssText = `position:absolute;left:${xLeft + 6}px;top:${u.valToPos(y, "y") - 14}px;font-size:10px;color:#333;background:rgba(255,255,255,0.92);padding:1px 5px;border-radius:2px;border-left:2px solid ${u.series[i].stroke || "#888"};pointer-events:none;white-space:nowrap;z-index:100;line-height:1.5;`;
          d.textContent = `${u.series[i].label || ""}:${fmtNum(y)}`;
          container.appendChild(d); labels.push(d);
        }
      } catch { /* keep cursor working */ }
    },
    destroy() { removeAll(); container.removeEventListener("mouseleave", removeAll); },
  };
}

interface Props {
  setEditDraft: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setActiveTab: (key: string) => void;
  modelInfo?: ModelInfoMap;
  sysName?: string;
  modelVersion?: string;
  modelParam?: string;
}

export default function DisturbTab({ setEditDraft, setActiveTab, modelInfo, sysName, modelVersion, modelParam }: Props) {
  const [disturbTree, setDisturbTree] = useState<DisturbanceDirNode>({});
  const [disturbChecked, setDisturbChecked] = useState<Record<string, boolean>>({});
  const [disturbExpanded, setDisturbExpanded] = useState<Record<string, boolean>>({});
  const [selDisturbFile, setSelDisturbFile] = useState("");
  const [disturbColumns, setDisturbColumns] = useState<DisturbanceColumn[]>([]);
  const [disturbVisible, setDisturbVisible] = useState<Record<string, boolean>>({});
  const [disturbWidth, setDisturbWidth] = useState(500);
  const [chartType, setChartType] = useState<"s" | "t" | "f" | null>(null);
  const [loading, setLoading] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInst = useRef<any>(null);
  const cursorLbls = useRef<Cursors | null>(null);

  // ── 根据 modelInfo 的 Product/DisturbanceFolders 过滤树 ──
  const disturbEntries = (() => {
    const dirs = disturbTree?.dirs;
    if (!dirs) return [];
    const entries = Object.entries(dirs);
    if (!sysName || !modelInfo) return entries;
    const ver = modelVersion || "3X";
    const sysEntry = (modelInfo as any)[ver]?.[sysName];
    if (!sysEntry) return entries;
    const product = sysEntry.Product;
    const folders = sysEntry.DisturbanceFolders;
    // Product 和 DisturbanceFolders 都没有 → 不过滤
    if (!product && folders === undefined) return entries;
    // 过滤第一层：Product
    let filtered = entries;
    if (product) {
      const products = typeof product === "string" ? product.split(",").map((s: string) => s.trim()) : [String(product)];
      filtered = filtered.filter(([k]) => products.includes(k));
    }
    return filtered;
  })();
  const disturbFolders = (() => {
    if (!sysName || !modelInfo) return null;
    const ver = modelVersion || "3X";
    const sysEntry = (modelInfo as any)[ver]?.[sysName];
    if (!sysEntry) return null;
    const folders = sysEntry.DisturbanceFolders;
    if (!folders) return [];
    return typeof folders === "string" ? folders.split(",").map((s: string) => s.trim()) : [String(folders)];
  })();

  useEffect(() => {
    (async () => {
      try {
        const r = await queueDisturbances();
        if (r.success && r.data) {
          setDisturbTree(r.data);
          // auto-expand all
          function expandAll(node: any, p: string): Record<string, boolean> {
            const keys: Record<string, boolean> = {};
            const dirs = node.dirs || {};
            Object.entries(dirs).forEach(([k, v]) => {
              const full = p ? `${p}/${k}` : k;
              keys[full] = true;
              Object.assign(keys, expandAll(v, full));
            });
            return keys;
          }
          setDisturbExpanded(expandAll(r.data, ""));
        }
      } catch { /* */ }
    })();
  }, []);

  // ── 恢复扰动勾选：优先 model_param.DisturbanceFiles，回退 modelInfo.DisturbanceFiles ──
  const restoreAppliedRef = useRef("");
  useEffect(() => {
    if (!sysName || Object.keys(disturbTree).length === 0) return;
    if (restoreAppliedRef.current === sysName) return;

    let fileNames: string[] = [];
    // 1. 从 model_param[version][sysName].DisturbanceFiles 读取
    if (modelParam) {
      try {
        const mp = JSON.parse(modelParam);
        const ver = modelVersion || "3X";
        const mpDist = mp[ver]?.[sysName]?.DisturbanceFiles;
        if (Array.isArray(mpDist)) fileNames = mpDist.map((f: any) => String(f).trim()).filter(Boolean);
      } catch { /* */ }
    }
    // 2. 回退到 modelInfo.DisturbanceFiles
    if (fileNames.length === 0 && modelInfo) {
      const ver = modelVersion || "3X";
      const sysEntry = (modelInfo as any)[ver]?.[sysName];
      if (sysEntry) {
        const dfRaw = sysEntry.DisturbanceFiles;
        if (dfRaw) {
          fileNames = Array.isArray(dfRaw)
            ? dfRaw.map((f: any) => String(f).trim()).filter(Boolean)
            : typeof dfRaw === "string"
              ? dfRaw.split(",").map((f: string) => f.trim()).filter(Boolean)
              : [];
        }
      }
    }
    if (fileNames.length === 0) return;
    // 匹配 disturbTree 中的文件路径
    const allFiles: { path: string; name: string }[] = [];
    (function walk(n: any) {
      (n.files || []).forEach((f: any) => allFiles.push({ path: f.path, name: f.name }));
      Object.values(n.dirs || {}).forEach((v: any) => walk(v));
    })(disturbTree);
    const ck: Record<string, boolean> = {};
    fileNames.forEach((fn) => {
      const match = allFiles.find((af) => af.name === fn);
      if (match) ck[match.path] = true;
    });
    setDisturbChecked(ck);
    restoreAppliedRef.current = sysName;
  }, [sysName, modelInfo, disturbTree]);

  // ── Chart ──
  useEffect(() => {
    cursorLbls.current?.destroy(); cursorLbls.current = null;
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    if (!chartRef.current || disturbColumns.length === 0) return;

    const active = disturbColumns.filter((c) => disturbVisible[c.name] !== false);
    const nonEmpty = active.filter((c) => c.data && c.data.some((v) => !isNil(v)));
    if (nonEmpty.length === 0) return;

    let xCol: typeof nonEmpty[0] | undefined;
    let yCols: typeof nonEmpty = [];
    let isFreq = false;

    if (chartType === "s") {
      xCol = nonEmpty[0];
      yCols = nonEmpty.slice(1);
    } else if (chartType === "t") {
      xCol = nonEmpty.find((c) => /^time$/i.test(c.name));
      yCols = nonEmpty.filter((c) => !/^time$/i.test(c.name));
    } else if (chartType === "f") {
      xCol = nonEmpty.find((c) => /freq/i.test(c.name));
      yCols = nonEmpty.filter((c) => !/freq/i.test(c.name));
      isFreq = true;
    } else {
      // fallback: 索引轴
      makeTimeChart(nonEmpty[0].data.map((_: any, i: number) => i), nonEmpty, undefined, "");
      return;
    }

    if (!xCol) xCol = nonEmpty[0];
    if (yCols.length === 0) yCols = nonEmpty.slice(1);

    const xData = xCol.data.map((v) => (isNil(v) ? null : Number(v))) as (number | null)[];
    const seriesData = yCols.map((c) => c.data.map((v) => (isNil(v) ? null : Number(v))) as (number | null)[]);

    if (isFreq) {
      makeFreqChart(xData, yCols, seriesData);
    } else if (chartType === "s") {
      makeTimeChart(xData, yCols, seriesData, xCol.name);
    } else {
      makeTimeChart(xData, yCols, seriesData, "Time (s)");
    }
  }, [disturbColumns, disturbVisible, chartType, disturbWidth]);

  // ── Chart builders ──
  function makeTimeChart(xData: (number | null)[], yCols: typeof disturbColumns, seriesData?: (number | null)[][], xLabel?: string) {
    const el = chartRef.current!;
    const lbls = makeCursorLabels(el); cursorLbls.current = lbls;
    const label = xLabel ?? "Time (s)";
    const series: Array<object> = [{ label }];
    const colors = yCols.map((_, i) => `hsl(${(i * 60) % 360},70%,50%)`);
    (seriesData || yCols.map((c) => c.data.map((v) => (isNil(v) ? null : Number(v))))).forEach((_, i) => {
      series.push({ label: yCols[i]?.name || `col${i}`, stroke: colors[i], width: 1.2, value: (_u: unknown, v: number) => v == null ? "" : fmtNum(v) });
    });
    const data = [xData, ...(seriesData || yCols.map((c) => c.data.map((v) => (isNil(v) ? null : Number(v)))))];
    try {
      chartInst.current = new (uPlot as any)(
        {
          width: el.offsetWidth || 800, height: 400,
          cursor: { show: true, drag: { setScale: true, x: true, y: false } },
          legend: { show: true },
          scales: { x: { time: false } },
          axes: [
            { label, grid: { stroke: "#f0f0f0" }, stroke: "#888", values: (_s: any, ticks: number[]) => ticks.map((t: number) => fmtNum(t)) },
            { stroke: "#000", grid: { stroke: "#f0f0f0" }, size: 80, values: (_s: any, ticks: number[]) => ticks.map((t: number) => fmtNum(t)) },
          ],
          series,
          hooks: { setCursor: [lbls.hook] },
        },
        data, el,
      );
    } catch { /* */ }
  }

  function makeFreqChart(xData: (number | null)[], yCols: typeof disturbColumns, seriesData: (number | null)[][]) {
    const el = chartRef.current!;
    const lbls = makeCursorLabels(el); cursorLbls.current = lbls;
    const series: Array<object> = [{ label: "Frequency (Hz)" }];
    const colors = yCols.map((_, i) => `hsl(${(i * 60) % 360},70%,50%)`);
    seriesData.forEach((_, i) => {
      series.push({ label: yCols[i]?.name || `col${i}`, stroke: colors[i], width: 1.2, value: (_u: unknown, v: number) => v == null ? "" : fmtNum(v) });
    });
    const data = [xData, ...seriesData];
    try {
      chartInst.current = new (uPlot as any)(
        {
          width: el.offsetWidth || 800, height: 400,
          cursor: { show: true, drag: { setScale: true, x: true, y: false } },
          legend: { show: true },
          scales: { x: { time: false, distr: 3, log: 10, min: 1, max: 20000 } },
          axes: [
            { label: "Frequency (Hz)", grid: { stroke: "#f0f0f0" }, stroke: "#888", values: (_s: any, ticks: number[]) => ticks.map((t: number) => { const lg = Math.log10(t); return Math.abs(lg - Math.round(lg)) < 1e-10 ? fmtNum(t) : ""; }) },
            { stroke: "#000", grid: { stroke: "#f0f0f0" }, size: 80, values: (_s: any, ticks: number[]) => ticks.map((t: number) => fmtNum(t)) },
          ],
          series,
          hooks: { setCursor: [lbls.hook] },
        },
        data, el,
      );
    } catch { /* */ }
  }

  // ── Handlers ──
  function getFileIcon(fpath: string): { icon: React.ReactNode; color: string } {
  const fname = fpath.split(/[/\\]/).pop() || "";
  const parts = fname.split("_");
  const ch = (parts[7] || "").toLowerCase();
  if (ch === "s") return { icon: <ControlOutlined style={{ fontSize: 11, color: "#f59e0b" }} />, color: "#f59e0b" };
  if (ch === "t") return { icon: <StockOutlined style={{ fontSize: 11, color: "#3b82f6" }} />, color: "#3b82f6" };
  if (ch === "f") return { icon: <FundOutlined style={{ fontSize: 11, color: "#10b981" }} />, color: "#10b981" };
  return { icon: <StockOutlined style={{ fontSize: 11, color: "#3b82f6" }} />, color: "#3b82f6" };
}

function onDisturbCheck(fullPath: string) {
    setDisturbChecked((prev) => {
      const next = { ...prev };
      if (next[fullPath]) delete next[fullPath];
      else next[fullPath] = true;
      const names = Object.entries(next).filter(([, v]) => v).map(([k]) => k.split(/[/\\]/).pop()!).filter(Boolean);
      // 写入 model_param[version][sysName].DisturbanceFiles
      const ver = modelVersion || "3X";
      setEditDraft((prev) => {
        let mp: Record<string, any> = {};
        try { mp = JSON.parse(prev.model_param || "{}"); } catch { /* */ }
        if (!mp[ver]) mp[ver] = {};
        if (!mp[ver][sysName || ""]) mp[ver][sysName || ""] = {};
        mp[ver][sysName || ""].DisturbanceFiles = names;
        return { ...prev, model_param: JSON.stringify(mp) };
      });
      return next;
    });
  }

  async function onDisturbLeafClick(filePath: string) {
    setSelDisturbFile(filePath);
    setActiveTab("disturb");
    setDisturbColumns([]);
    setChartType(null);
    setLoading(true);
    cursorLbls.current?.destroy(); cursorLbls.current = null;
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    try {
      const r = await getDisturbanceInfo(filePath);
      if (r.success && r.data?.columns) {
        const fname = filePath.split(/[/\\]/).pop() || "";
        const parts = fname.split("_");
        const ch = (parts[7] || "").toLowerCase();
        setChartType(ch === "s" || ch === "t" || ch === "f" ? ch : null);
        setDisturbColumns(r.data.columns);
        const vis: Record<string, boolean> = {};
        r.data.columns.forEach((c) => { vis[c.name] = true; });
        setDisturbVisible((prev) => ({ ...prev, ...vis }));
      }
    } catch { /* */ }
    setLoading(false);
  }

  function startResize(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const editBody = target.parentElement!;
    const bodyLeft = editBody.getBoundingClientRect().left;
    const bodyW = editBody.offsetWidth;
    document.body.style.userSelect = "none";
    function onMove(ev: MouseEvent) { setDisturbWidth(Math.min(bodyW * 0.6, Math.max(180, ev.clientX - bodyLeft))); }
    function onUp() { document.body.style.userSelect = ""; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <div className="flex-1 flex overflow-hidden min-h-0">
      <div className="shrink-0 overflow-y-auto overflow-x-hidden box-border border-r border-[#f0f0f0] bg-white pb-3 min-h-0" style={{ width: disturbWidth }}>
        {disturbEntries.map(([k, v]) => (
          <DistTreeNode key={k} name={k} value={v} path={k} checked={disturbChecked} expanded={disturbExpanded}
            selFile={selDisturbFile}
            onToggle={(p) => setDisturbExpanded((prev) => ({ ...prev, [p]: !prev[p] }))}
            onCheck={onDisturbCheck} onLeafClick={onDisturbLeafClick} folders={disturbFolders}
          />
        ))}
        {(disturbTree.files?.length ?? 0) > 0 && (
          <>
            {disturbTree.files!.map((f) => (
              <div className="whitespace-nowrap" key={f.path}>
                <div className="flex items-center gap-0.5 px-3 py-0.5 text-xs transition-colors duration-100 select-none hover:bg-[#e6f4ff]">
                  <input type="checkbox" checked={!!disturbChecked[f.path]} onChange={() => onDisturbCheck(f.path)} style={{ cursor: "pointer" }} />
                  <span className="shrink-0">{getFileIcon(f.path).icon}</span>
                  <span title={f.name} style={{ cursor: "pointer", color: selDisturbFile === f.path ? "#3b82f6" : undefined }}
                    onClick={() => onDisturbLeafClick(f.path)}>{f.name}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="w-1 bg-[#f0f0f0] cursor-col-resize shrink-0 border-l border-r border-[#f0f0f0] transition-colors hover:bg-[#d9d9d9]" onMouseDown={startResize} />
      <div className="flex-1 overflow-y-auto overflow-x-hidden box-border px-4 py-3 min-w-0 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Spin size="large" /></div>
        ) : disturbColumns.length > 0 ? (
          <>
            {chartType && (
              <div className="text-[13px] font-semibold text-[#555] mb-2">
                {chartType === "s" ? "参数扰动" : chartType === "t" ? "时域扰动" : "频域扰动"}
              </div>
            )}
            <div ref={chartRef} className="mb-2 disturb-chart" style={{ position: "relative" }} />
          </>
        ) : (
          <div className="edit-right-empty">点击左侧文件查看扰动数据</div>
        )}
      </div>
    </div>
  );
}
