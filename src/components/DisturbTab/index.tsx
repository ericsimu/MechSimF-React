import { useState, useEffect, useRef } from "react";
import { queueDisturbances, getDisturbanceInfo } from '@/api/index';
import { isNil } from '@/utils/isNil';
import DistTreeNode from '@/components/DistTreeNode';
import type { DisturbanceDirNode, DisturbanceColumn } from '@/types/api';
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { StockOutlined } from "@ant-design/icons";

interface Props {
  disturbance?: string;
  setEditDraft: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setActiveTab: (key: string) => void;
}

export default function DisturbTab({ disturbance, setEditDraft, setActiveTab }: Props) {
  const [disturbTree, setDisturbTree] = useState<DisturbanceDirNode>({});
  const [disturbChecked, setDisturbChecked] = useState<Record<string, boolean>>({});
  const [disturbExpanded, setDisturbExpanded] = useState<Record<string, boolean>>({});
  const [selDisturbFile, setSelDisturbFile] = useState("");
  const [disturbColumns, setDisturbColumns] = useState<DisturbanceColumn[]>([]);
  const [disturbVisible, setDisturbVisible] = useState<Record<string, boolean>>({});
  const [disturbWidth, setDisturbWidth] = useState(280);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInst = useRef<any>(null);

  const disturbEntries = (() => {
    const dirs = disturbTree?.dirs;
    return dirs ? Object.entries(dirs) : [];
  })();

  // ── Init: load tree ──
  useEffect(() => {
    (async () => {
      try {
        const r = await queueDisturbances();
        if (r.success && r.data) setDisturbTree(r.data);
      } catch { /* */ }
    })();
  }, []);

  // ── Restore checked state from editDraft.disturbance ──
  useEffect(() => {
    if (!disturbance) return;
    try {
      const d = JSON.parse(disturbance);
      if (d?.length > 0) {
        const ck: Record<string, boolean> = {};
        d.forEach((x: any) => { if (x.checked) ck[x.path] = true; });
        setDisturbChecked(ck);
      }
    } catch { /* */ }
  }, [disturbance]);

  // ── Chart ──
  useEffect(() => {
    if (!chartRef.current || disturbColumns.length === 0) {
      if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
      return;
    }
    const active = disturbColumns.filter((c) => disturbVisible[c.name] !== false);
    const nonEmpty = active.filter((c) => c.data && c.data.some((v) => !isNil(v)));
    if (nonEmpty.length === 0) {
      if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
      return;
    }
    const xData = nonEmpty[0].data.map((_, i) => i);
    const series: Array<object> = [{}];
    nonEmpty.forEach((c, i) => series.push({ label: c.name, stroke: `hsl(${(i * 60) % 360},70%,50%)`, width: 1.5 }));
    const data = [xData, ...nonEmpty.map((c) => c.data.map((v) => (isNil(v) ? null : Number(v))) || [])];
    if (chartInst.current) chartInst.current.destroy();
    try {
      chartInst.current = new (uPlot as any)(
        { width: chartRef.current.offsetWidth, height: 400, cursor: { show: true }, legend: { show: false }, scales: { x: { time: false } }, axes: [{}, { stroke: "#888", grid: { stroke: "#f0f0f0" } }], series },
        data, chartRef.current,
      );
    } catch { /* */ }
  }, [disturbColumns, disturbVisible]);

  // ── Handlers ──
  function onDisturbCheck(fullPath: string) {
    setDisturbChecked((prev) => {
      const next = { ...prev };
      if (next[fullPath]) delete next[fullPath];
      else next[fullPath] = true;
      const dist = Object.entries(next).filter(([, v]) => v).map(([k]) => ({ path: k, name: k.split(/[/\\]/).pop(), checked: true }));
      setEditDraft((prev) => ({ ...prev, disturbance: JSON.stringify(dist) }));
      return next;
    });
  }

  async function onDisturbLeafClick(filePath: string) {
    setSelDisturbFile(filePath);
    setActiveTab("disturb");
    setDisturbColumns([]);
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    try {
      const r = await getDisturbanceInfo(filePath);
      if (r.success && r.data?.columns) {
        setDisturbColumns(r.data.columns);
        const vis: Record<string, boolean> = {};
        r.data.columns.forEach((c) => { vis[c.name] = true; });
        setDisturbVisible((prev) => ({ ...prev, ...vis }));
      }
    } catch { /* */ }
  }

  // ── Resize ──
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
            onCheck={onDisturbCheck} onLeafClick={onDisturbLeafClick}
          />
        ))}
        {(disturbTree.files?.length ?? 0) > 0 && (
          <>
            {disturbTree.files!.map((f) => (
              <div className="whitespace-nowrap" key={f.path}>
                <div className="flex items-center gap-0.5 px-3 py-0.5 text-xs transition-colors duration-100 select-none hover:bg-[#e6f4ff]">
                  <input type="checkbox" checked={!!disturbChecked[f.path]} onChange={() => onDisturbCheck(f.path)} style={{ cursor: "pointer" }} />
                  <StockOutlined style={{ fontSize: 11, color: "#3b82f6" }} className="shrink-0" />
                  <span style={{ cursor: "pointer", color: selDisturbFile === f.path ? "#3b82f6" : undefined }}
                    onClick={() => onDisturbLeafClick(f.path)}>{f.name}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="w-1 bg-[#f0f0f0] cursor-col-resize shrink-0 border-l border-r border-[#f0f0f0] transition-colors hover:bg-[#d9d9d9]" onMouseDown={startResize} />
      <div className="flex-1 overflow-y-auto overflow-x-hidden box-border px-4 py-3 min-w-0 min-h-0">
        {disturbColumns.length > 0 && (
          <>
            <div ref={chartRef} className="mb-2" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-1.5 py-1.5 text-xs">
              {disturbColumns.map((c, i) => (
                <label key={c.name} className="inline-flex items-center gap-1 cursor-pointer select-none text-[#555]">
                  <input type="checkbox" checked={disturbVisible[c.name] !== false}
                    onChange={() => setDisturbVisible((prev) => ({ ...prev, [c.name]: !prev[c.name] }))} />
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: `hsl(${(i * 60) % 360},70%,50%)` }} />
                  {c.name}
                </label>
              ))}
            </div>
          </>
        )}
        {disturbColumns.length === 0 && <div className="edit-right-empty">点击左侧文件查看扰动数据</div>}
      </div>
    </div>
  );
}
