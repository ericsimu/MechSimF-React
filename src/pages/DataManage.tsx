import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Button,
  Upload,
  Select,
  Input,
  Tree,
  message,
  Spin,
  Modal,
} from "antd";
import {
  UploadOutlined,
  InboxOutlined,
  ImportOutlined,
} from "@ant-design/icons";
import type { DataNode } from "antd/es/tree";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import {
  uploadRawData,
  importRawData,
  queueDisturbances,
  queueDataSim,
  processToSim,
  getDisturbanceInfo,
} from "../api/index";
import type { DisturbanceDirNode, DisturbanceColumn } from "../types/api";

const { Dragger } = Upload;

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
];

const DROPDOWN_LABELS = [
  "产品线", "子系统", "模块", "控制器", "信号类型", "额定电流", "方向",
];

function fmtNum(v: number): string {
  if (!isFinite(v)) return String(v);
  const av = Math.abs(v);
  if (av === 0) return "0";
  if (av < 0.001 || av >= 10000) return v.toExponential(4);
  const s = v.toFixed(10);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

function nowTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function getOptionsAtLevel(
  tree: DisturbanceDirNode | null,
  path: string[],
  level: number,
): string[] {
  if (!tree) return [];
  let node: DisturbanceDirNode | undefined = tree;
  for (let i = 0; i < level && i < path.length; i++) {
    node = node?.dirs?.[path[i]];
    if (!node) return [];
  }
  return node?.dirs ? Object.keys(node.dirs) : [];
}

function toTreeData(
  node: DisturbanceDirNode | null,
  prefix = "",
): DataNode[] {
  if (!node) return [];
  const result: DataNode[] = [];
  if (node.dirs) {
    for (const [name, sub] of Object.entries(node.dirs)) {
      const key = prefix ? `${prefix}/${name}` : name;
      const children = toTreeData(sub, key);
      result.push({
        title: name,
        key,
        children: children.length > 0 ? children : undefined,
      } as DataNode);
    }
  }
  if (node.files) {
    for (const f of node.files) {
      result.push({
        title: f.name,
        key: f.path,
        isLeaf: true,
      } as DataNode);
    }
  }
  return result;
}

export default function DataManage() {
  const [uploading, setUploading] = useState(false);
  const [tempPath, setTempPath] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");

  const [rawTree, setRawTree] = useState<DisturbanceDirNode | null>(null);
  const [simTree, setSimTree] = useState<DisturbanceDirNode | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);

  const [parts, setParts] = useState<string[]>(Array(7).fill(""));
  const [version, setVersion] = useState("00.00.99");
  const [ts, setTs] = useState(nowTimestamp());

  const [importing, setImporting] = useState(false);
  const [processMethod, setProcessMethod] = useState("calDiffNoise");
  const [selectedRawFile, setSelectedRawFile] = useState<string | null>(null);
  const [selectedSimFile, setSelectedSimFile] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [previewColumns, setPreviewColumns] = useState<DisturbanceColumn[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInst = useRef<uPlot | null>(null);

  // Load trees on mount
  const loadTrees = useCallback(async () => {
    setTreeLoading(true);
    try {
      const [rawRes, simRes] = await Promise.all([
        queueDisturbances(),
        queueDataSim(),
      ]);
      if (rawRes.success) setRawTree(rawRes.data ?? null);
      if (simRes.success) setSimTree(simRes.data ?? null);
    } catch {
      message.error("加载数据树失败");
    } finally {
      setTreeLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrees();
  }, [loadTrees]);

  // Compute dropdown options (cascading)
  const dropdownOptions = useMemo(() => {
    const opts: string[][] = [];
    for (let i = 0; i < 7; i++) {
      opts.push(getOptionsAtLevel(rawTree, parts, i));
    }
    return opts;
  }, [rawTree, parts]);

  const previewFilename = useMemo(() => {
    if (parts.every((p) => !p)) return "";
    return `${parts.join("_")}_v${version}_${ts}.csv`;
  }, [parts, version, ts]);

  // Upload handlers
  async function handleUpload(file: File): Promise<false | undefined> {
    setUploading(true);
    try {
      const res = await uploadRawData(file);
      if (res.success && res.data) {
        setTempPath(res.data.temp_path);
        setUploadedFileName(res.data.filename);
        message.success(`上传成功: ${res.data.filename}`);
      }
    } catch (e: any) {
      message.error(e?.message || "上传失败");
    } finally {
      setUploading(false);
    }
    return false; // Prevent default upload behavior
  }

  // Import handler
  async function handleImport() {
    if (!tempPath) {
      message.warning("请先上传文件");
      return;
    }
    if (parts.some((p) => !p)) {
      message.warning("请完成所有下拉选项");
      return;
    }
    if (!version.trim() || !ts.trim()) {
      message.warning("请输入版本号和时间戳");
      return;
    }
    setImporting(true);
    try {
      await importRawData({ temp_path: tempPath, parts, version: version.trim(), timestamp: ts.trim() });
      message.success("导入成功");
      setTempPath("");
      setUploadedFileName("");
      loadTrees();
    } catch (e: any) {
      message.error(e?.message || "导入失败");
    } finally {
      setImporting(false);
    }
  }

  // Load preview data when a tree file is selected
  const previewFile = selectedRawFile || selectedSimFile;

  async function loadPreview(filePath: string) {
    setPreviewLoading(true);
    try {
      const res = await getDisturbanceInfo(filePath);
      if (res.success && res.data) {
        setPreviewColumns(res.data.columns);
      }
    } catch {
      // ignore
    } finally {
      setPreviewLoading(false);
    }
  }

  // Process to sim
  async function handleProcessToSim() {
    if (!selectedRawFile) {
      message.warning("请先在左侧原始数据中选择文件");
      return;
    }
    Modal.confirm({
      title: "确认处理",
      content: `使用 "${processMethod}" 将 "${selectedRawFile.split(/[\\/]/).pop()}" 转换为仿真数据？`,
      onOk: async () => {
        setProcessing(true);
        try {
          await processToSim({ file_path: selectedRawFile, method: processMethod });
          message.success("处理成功");
          const simRes = await queueDataSim();
          if (simRes.success) setSimTree(simRes.data ?? null);
        } catch (e: any) {
          message.error(e?.message || "处理失败");
        } finally {
          setProcessing(false);
        }
      },
    });
  }

  // Build uPlot chart when preview columns change
  useEffect(() => {
    if (chartInst.current) {
      chartInst.current.destroy();
      chartInst.current = null;
    }
    const el = chartRef.current;
    if (!el || previewColumns.length === 0) return;

    const timeCol =
      previewColumns.find((c) => /time/i.test(c.name)) || previewColumns[0];
    const sigCols = previewColumns.filter(
      (c) => c !== timeCol && c.data.length > 0,
    );
    const timeArr =
      timeCol.data.length > 0
        ? timeCol.data.map((v) => v ?? 0)
        : sigCols[0]?.data.map((_, i) => i) ?? [];

    const series: Array<object> = [
      { label: timeCol.name, value: (_u: unknown, v: number) => fmtNum(v) },
    ];
    for (const c of sigCols) {
      const ci = previewColumns.indexOf(c);
      series.push({
        label: c.name,
        stroke: COLORS[ci % COLORS.length],
        width: 1.5,
        value: (_u: unknown, v: number) => (v == null ? "" : fmtNum(v)),
      });
    }
    const signalArrs = sigCols.map((c) =>
      c.data.map((v) => (v == null ? null : Number(v))),
    );

    const w = el.offsetWidth || 800;
    const h = el.offsetHeight || 280;
    chartInst.current = new (uPlot as any)(
      {
        width: w,
        height: h - 16,
        cursor: { show: true, drag: { setScale: true, x: true, y: false } },
        legend: { show: true },
        scales: { x: { time: false } },
        axes: [
          {
            label: timeCol.name,
            grid: { stroke: "#f0f0f0" },
            stroke: "#888",
            values: (_self: any, ticks: number[]) =>
              ticks.map((t) => fmtNum(t)),
          },
          {
            stroke: "#888",
            grid: { stroke: "#f0f0f0" },
            values: (_self: any, ticks: number[]) =>
              ticks.map((t) => fmtNum(t)),
          },
        ],
        series,
      },
      [timeArr, ...signalArrs],
      el,
    );
  }, [previewColumns]);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        direction: "rtl",
        padding: "16px 20px",
        position: "relative",
      }}
    >
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        direction: "ltr",
      }}
    >
      {/* Upload section */}
      <div>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          style={{ width: 224 }}
          onClick={() => {
            const input = document.querySelector<HTMLInputElement>(
              ".data-manage-upload input[type=file]",
            );
            input?.click();
          }}
        >
          上传原始数据文件（*.csv）
        </Button>
      </div>

      {/* Drag upload zone */}
      <div className="data-manage-upload">
        <Dragger
          accept=".csv"
          showUploadList={false}
          beforeUpload={(file) => {
            handleUpload(file);
            return false;
          }}
          disabled={uploading}
          style={{ padding: "3px 16px" }}
        >
          <p className="ant-upload-drag-icon" style={{ marginBottom: 0, fontSize: 18, lineHeight: 1 }}>
            <InboxOutlined />
          </p>
          <p style={{ fontSize: 11, color: "#999", margin: 0, lineHeight: 1.4 }}>
            点击或拖拽 CSV 文件到此区域上传
          </p>
        </Dragger>
        {uploading && (
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <Spin size="small" />
          </div>
        )}
        {uploadedFileName && !uploading && (
          <div style={{ textAlign: "center", marginTop: 6, fontSize: 13, color: "#389e0d" }}>
            已上传: {uploadedFileName}
          </div>
        )}
      </div>

      {/* Filename builder — 7 dropdowns + version + timestamp */}
      <div
        style={{
          background: "#fafafa",
          border: "1px solid #f0f0f0",
          borderRadius: 6,
          padding: "12px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {parts.map((val, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Select
                value={val || undefined}
                placeholder={DROPDOWN_LABELS[i]}
                style={{ width: 110 }}
                size="small"
                options={(dropdownOptions[i] || []).map((o) => ({
                  value: o,
                  label: o,
                }))}
                onChange={(v) => {
                  const next = [...parts];
                  next[i] = v;
                  for (let j = i + 1; j < 7; j++) next[j] = "";
                  setParts(next);
                }}
              />
              {i < 6 && (
                <span style={{ color: "#bbb", fontWeight: 600 }}>_</span>
              )}
            </span>
          ))}
          <span style={{ color: "#bbb", fontWeight: 600, marginLeft: 4 }}>_v</span>
          <Input
            size="small"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            style={{ width: 100 }}
            placeholder="版本号"
          />
          <span style={{ color: "#bbb", fontWeight: 600 }}>_</span>
          <Input
            size="small"
            value={ts}
            onChange={(e) => setTs(e.target.value)}
            style={{ width: 160 }}
            placeholder="时间戳"
          />
          <span style={{ color: "#bbb", fontWeight: 600 }}>.csv</span>
        </div>
      </div>

      {/* Import button row */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Button
          type="primary"
          icon={<ImportOutlined />}
          onClick={handleImport}
          loading={importing}
          style={{ width: 224 }}
        >
          导入原始数据文件
        </Button>
        {previewFilename && (
          <span style={{ fontSize: 12, color: "#888", fontFamily: "Consolas, Monaco, monospace" }}>
            文件名预览: {previewFilename}
          </span>
        )}
      </div>

      {/* Tree panels */}
      <div
        style={{
          flex: 2,
          display: "flex",
          gap: 12,
          minHeight: 0,
        }}
      >
        {/* Raw data tree */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            border: "1px solid #f0f0f0",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              fontWeight: 600,
              fontSize: 14,
              background: "#fafafa",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            原始数据 (data_raw)
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
            {treeLoading ? (
              <Spin style={{ display: "block", padding: 24 }} />
            ) : (
              <Tree.DirectoryTree
                treeData={toTreeData(rawTree)}
                onSelect={(keys) => {
                  const key = keys[0] as string | undefined;
                  if (key && /\.(csv|xlsx?|xlsm)$/i.test(key)) {
                    setSelectedRawFile(key);
                    setSelectedSimFile(null);
                    loadPreview(key);
                  }
                }}
                defaultExpandAll={false}
                style={{ fontSize: 13 }}
              />
            )}
          </div>
        </div>

        {/* Middle: processing method + action */}
        <div
          style={{
            width: 120,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Select
            value={processMethod}
            onChange={(v) => setProcessMethod(v)}
            style={{ width: "100%" }}
            size="small"
            options={[
              { value: "calDiffNoise", label: "calDiffNoise" },
              { value: "calMFC", label: "calMFC" },
            ]}
          />
          <Button
            type="primary"
            size="small"
            loading={processing}
            onClick={handleProcessToSim}
          >
            {'-->'}
          </Button>
        </div>

        {/* Sim data tree */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            border: "1px solid #f0f0f0",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              fontWeight: 600,
              fontSize: 14,
              background: "#fafafa",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            仿真数据 (data_sim)
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
            {treeLoading ? (
              <Spin style={{ display: "block", padding: 24 }} />
            ) : (
              <Tree.DirectoryTree
                treeData={toTreeData(simTree)}
                onSelect={(keys) => {
                  const key = keys[0] as string | undefined;
                  if (key && /\.(csv|xlsx?|xlsm)$/i.test(key)) {
                    setSelectedSimFile(key);
                    setSelectedRawFile(null);
                    loadPreview(key);
                  }
                }}
                defaultExpandAll={false}
                style={{ fontSize: 13 }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Waveform preview */}
      <div
        style={{
          flex: 3,
          display: "flex",
          flexDirection: "column",
          border: "1px solid #f0f0f0",
          borderRadius: 6,
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            fontWeight: 600,
            fontSize: 14,
            background: "#fafafa",
            borderBottom: "1px solid #f0f0f0",
            flexShrink: 0,
          }}
        >
          波形预览
          {previewFile && (
            <span style={{ fontWeight: 400, fontSize: 12, color: "#888", marginLeft: 12 }}>
              {previewFile.split(/[\\/]/).pop()}
            </span>
          )}
        </div>
        <div style={{ flex: 1, padding: "12px 16px", minHeight: 0, display: "flex" }}>
          {previewLoading ? (
            <Spin style={{ display: "block", padding: 24 }} />
          ) : previewColumns.length > 0 ? (
            <div ref={chartRef} style={{ flex: 1 }} />
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
                fontSize: 14,
              }}
            >
              点击左侧树中的文件查看波形
            </div>
          )}
        </div>
      </div>
    </div>
      {/* 半透明幕布 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255,255,255,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          cursor: "not-allowed",
        }}
      >
        <span style={{ fontSize: 24, color: "#999", fontWeight: 500, letterSpacing: 4 }}>
          功能开发中
        </span>
      </div>
    </div>
  );
}
