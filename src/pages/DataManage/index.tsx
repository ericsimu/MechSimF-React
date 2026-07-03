import { useState, useEffect, useCallback, useMemo } from "react";
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
  InboxOutlined,
  ImportOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  ExperimentOutlined,
} from "@ant-design/icons";
import type { DataNode } from "antd/es/tree";
import {
  uploadRawData,
  importRawData,
  queueDisturbances,
  queueDataRaw,
  processToSim,
  fetchSummaryCsvOptions,
  deleteDataFiles,
} from '@/api/index';
import type { DisturbanceDirNode, SummaryCsvOptions } from '@/types/api';

const { Dragger } = Upload;

const PATH_LABELS = ["项目代号", "子系统", "模块", "数据类别"];
const TAG_LABELS = ["标签", "机台号", "数据来源", "域类别"];

/**
 * 从原始文件绝对路径中提取 data_raw 之后的相对路径段，在 sim 树中查找同名文件。
 * 返回 { simPath, expandedKeys } 或 null。
 */
function findSimFile(
  rawPath: string,
  simTree: DisturbanceDirNode | null,
): { filePath: string; expandedKeys: string[] } | null {
  const norm = rawPath.replace(/\\/g, "/");
  const idx = norm.indexOf("data_raw/");
  if (idx < 0) return null;
  const rel = norm.slice(idx + "data_raw/".length);
  return _walkTree(rel, simTree);
}

function findRawFile(
  simPath: string,
  rawTree: DisturbanceDirNode | null,
): { filePath: string; expandedKeys: string[] } | null {
  const norm = simPath.replace(/\\/g, "/");
  const idx = norm.indexOf("data_sim/");
  if (idx < 0) return null;
  const rel = norm.slice(idx + "data_sim/".length);
  return _walkTree(rel, rawTree);
}

function _walkTree(
  rel: string,
  tree: DisturbanceDirNode | null,
): { filePath: string; expandedKeys: string[] } | null {
  const segs = rel.split("/");
  const dirs = segs.slice(0, -1);
  const filename = segs[segs.length - 1];

  let node = tree;
  for (const d of dirs) {
    node = node?.dirs?.[d] ?? null;
    if (!node) return null;
  }
  const file = node?.files?.find((f) => f.name === filename);
  if (!file) return null;

  const expandedKeys: string[] = [];
  for (let i = 0; i < dirs.length; i++) {
    expandedKeys.push(dirs.slice(0, i + 1).join("/"));
  }
  return { filePath: file.path, expandedKeys };
}

function nowTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * 从上传文件名中柔性解析分类字段。
 * 期待格式: {p0}_{p1}_{p2}_{p3}_{p4}_{p5}_{p6}_{p7}_v{version}_{timestamp}.csv
 * 从尾部识别版本号（v 开头）和时间戳（14 位数字），其余段按顺序填入 8 个分类位。
 * 能解析多少填多少，不匹配的段留空。
 */
function parseFilename(
  filename: string,
): { parts: string[]; version: string; timestamp: string } {
  const name = filename.replace(/\.csv$/i, "");
  const segs = name.split("_");
  const parts = Array(8).fill("");
  let version = "";
  let timestamp = "";

  // 从尾部反向扫描：先识别时间戳，再识别版本号，其余为分类字段
  const remaining: string[] = [];
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    if (!timestamp && /^\d{14}$/.test(s)) {
      timestamp = s;
    } else if (!version && /^v([\d.]+)$/.test(s)) {
      version = s.slice(1);
    } else {
      remaining.unshift(s);
    }
  }

  // 按顺序填入 parts，最多 8 个
  for (let i = 0; i < Math.min(remaining.length, 8); i++) {
    parts[i] = remaining[i];
  }

  return { parts, version, timestamp };
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

/** 递归收集树中所有目录节点的 key，用于"全部展开" */
function getAllDirKeys(node: DisturbanceDirNode | null, prefix = ""): string[] {
  if (!node?.dirs) return [];
  const keys: string[] = [];
  for (const [name, sub] of Object.entries(node.dirs)) {
    const key = prefix ? `${prefix}/${name}` : name;
    keys.push(key);
    keys.push(...getAllDirKeys(sub, key));
  }
  return keys;
}

export default function DataManage() {
  const [uploading, setUploading] = useState(false);
  const [tempPath, setTempPath] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");

  const [rawTree, setRawTree] = useState<DisturbanceDirNode | null>(null);
  const [simTree, setSimTree] = useState<DisturbanceDirNode | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);

  const [parts, setParts] = useState<string[]>(Array(8).fill(""));
  const [version, setVersion] = useState("00.00.99");
  const [ts, setTs] = useState(nowTimestamp());

  const [importing, setImporting] = useState(false);
  const [processMethod, setProcessMethod] = useState("calDiffNoise");
  const [selectedRawFile, setSelectedRawFile] = useState<string | null>(null);
  const [_selectedSimFile, setSelectedSimFile] = useState<string | null>(null);
  const [rawExpandedKeys, setRawExpandedKeys] = useState<string[]>([]);
  const [rawSelectedKeys, setRawSelectedKeys] = useState<string[]>([]);
  const [simExpandedKeys, setSimExpandedKeys] = useState<string[]>([]);
  const [simSelectedKeys, setSimSelectedKeys] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  // Checkbox state for batch delete
  const [checkedRawKeys, setCheckedRawKeys] = useState<string[]>([]);
  const [checkedSimKeys, setCheckedSimKeys] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const [tagOptions, setTagOptions] = useState<SummaryCsvOptions>({ tag: [], machine: [], source: [], domain: [] });

  // Load trees and tag options on mount
  const loadTrees = useCallback(async () => {
    setTreeLoading(true);
    try {
      const [rawRes, simRes, optsRes] = await Promise.all([
        queueDataRaw(),
        queueDisturbances(),
        fetchSummaryCsvOptions(),
      ]);
      if (rawRes.success) setRawTree(rawRes.data ?? null);
      if (simRes.success) setSimTree(simRes.data ?? null);
      if (optsRes.success && optsRes.data) setTagOptions(optsRes.data);
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
    for (let i = 0; i < 4; i++) {
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

        // 先清空，再根据文件名解析并校验目录层级后填充
        const nextParts = Array(8).fill("");
        const parsed = parseFilename(res.data.filename);

        if (rawTree) {
          // 前 4 个字段（项目代号/子系统/模块/数据类别）需匹配 rawTree 目录层级
          let node: DisturbanceDirNode | undefined = rawTree;
          for (let i = 0; i < 4; i++) {
            const seg = parsed.parts[i];
            if (seg && node?.dirs?.[seg]) {
              nextParts[i] = seg;
              node = node.dirs[seg];
            } else {
              break; // 不匹配则停止，后续目录层级也留空
            }
          }
        } else {
          // 树未加载时退化为直接填充
          for (let i = 0; i < 4; i++) {
            if (parsed.parts[i]) nextParts[i] = parsed.parts[i];
          }
        }
        // 后 4 个字段（标签/机台号/数据来源/域类别）直接填入
        for (let i = 4; i < 8; i++) {
          if (parsed.parts[i]) nextParts[i] = parsed.parts[i];
        }

        setParts(nextParts);
        setVersion(parsed.version || "00.00.99");
        setTs(parsed.timestamp || nowTimestamp());
        const filledCount = nextParts.filter((p) => p !== "").length;
        if (filledCount > 0 || parsed.version || parsed.timestamp) {
          const anyPathSeg = parsed.parts.slice(0, 4).some((p) => p !== "");
          const noPathMatched = anyPathSeg && nextParts.slice(0, 4).every((p) => !p);
          message.info(
            noPathMatched
              ? "文件名与已有目录不匹配，仅填充标签字段"
              : `已从文件名解析填充 ${filledCount} 个字段`,
          );
        }
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
      const res = await importRawData({ temp_path: tempPath, parts, version: version.trim(), timestamp: ts.trim() });
      message.success("导入成功");
      setTempPath("");
      setUploadedFileName("");

      // 仅刷新原始数据树，导入完成后自动选中新文件
      const rawRes = await queueDataRaw();
      const newRawTree = rawRes.success ? (rawRes.data ?? null) : null;
      setRawTree(newRawTree);

      const filePath = res.data?.path;
      if (filePath && newRawTree) {
        setSelectedRawFile(filePath);
        setRawSelectedKeys([filePath]);
        // 计算展开路径：从绝对路径中提取 data_raw 之后的目录层级
        const norm = filePath.replace(/\\/g, "/");
        const idx = norm.indexOf("data_raw/");
        if (idx >= 0) {
          const rel = norm.slice(idx + "data_raw/".length);
          const segs = rel.split("/").slice(0, -1); // 去掉文件名
          const expandKeys: string[] = [];
          for (let i = 0; i < segs.length; i++) {
            expandKeys.push(segs.slice(0, i + 1).join("/"));
          }
          setRawExpandedKeys(expandKeys);
        }
      }
    } catch (e: any) {
      message.error(e?.message || "导入失败");
    } finally {
      setImporting(false);
    }
  }

  // Filter checked keys to file paths only (exclude directory keys)
  function filterFileKeys(keys: string[]): string[] {
    return keys.filter((k) => /\.(csv|xlsx?|xlsm)$/i.test(k));
  }

  // Batch delete checked files
  function handleDelete(treeType: "raw" | "sim") {
    const checkedKeys = treeType === "raw" ? checkedRawKeys : checkedSimKeys;
    const fileKeys = filterFileKeys(checkedKeys);
    if (fileKeys.length === 0) {
      message.warning("请先勾选要删除的文件");
      return;
    }
    const title = treeType === "raw" ? "原始数据" : "仿真数据";
    Modal.confirm({
      title: `确认删除 ${title} 文件`,
      content: `将删除 ${fileKeys.length} 个文件，此操作不可恢复。\n\n${fileKeys.map((f) => `• ${f.split(/[\\/]/).pop()}`).join("\n")}`,
      okText: "确认删除",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        setDeleting(true);
        try {
          const res = await deleteDataFiles(fileKeys);
          if (res.success) {
            message.success(res.message || `成功删除 ${fileKeys.length} 个文件`);
          } else {
            message.warning(res.message || "部分文件删除失败");
          }
          // Clear checked keys & reload trees
          if (treeType === "raw") setCheckedRawKeys([]);
          else setCheckedSimKeys([]);
          loadTrees();
        } catch (e: any) {
          message.error(e?.message || "删除失败");
        } finally {
          setDeleting(false);
        }
      },
    });
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
          const simRes = await queueDisturbances();
          if (simRes.success) {
            const freshTree = simRes.data ?? null;
            setSimTree(freshTree);
            const found = findSimFile(selectedRawFile, freshTree);
            if (found) {
              setSimExpandedKeys(found.expandedKeys);
              setSimSelectedKeys([found.filePath]);
              setSelectedSimFile(found.filePath);
            }
          }
        } catch (e: any) {
          message.error(e?.message || "处理失败");
        } finally {
          setProcessing(false);
        }
      },
    });
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: "16px 20px",
      }}
    >
      {/* Top fixed section */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
      {/* Drag upload zone */}
      <div style={{ marginBottom: 3 }}>
        <Dragger
          accept=".csv"
          showUploadList={false}
          beforeUpload={(file) => {
            handleUpload(file);
            return false;
          }}
          disabled={uploading}
          style={{ padding: "4px 16px" }}
        >
          {uploading ? (
            <p style={{ margin: 0, fontSize: 14, color: "#999", lineHeight: "10px" }}>
              <Spin size="small" style={{ marginRight: 3 }} />
              上传中...
            </p>
          ) : uploadedFileName ? (
            <p style={{ margin: 0, fontSize: 14, color: "#389e0d", lineHeight: "10px" }}>
              <InboxOutlined style={{ marginRight: 3 }} />
              已上传: {uploadedFileName}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: "#999", lineHeight: "10px" }}>
              <InboxOutlined style={{ marginRight: 3 }} />
              点击或拖拽CSV文件到此处上传原始数据文件
            </p>
          )}
        </Dragger>
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
              {i < 4 ? (
                <Select
                  value={val || undefined}
                  placeholder={PATH_LABELS[i]}
                  style={{ width: 110 }}
                  size="small"
                  options={(dropdownOptions[i] || []).map((o) => ({
                    value: o,
                    label: o,
                  }))}
                  onChange={(v) => {
                    const next = [...parts];
                    next[i] = v;
                    for (let j = i + 1; j < 4; j++) next[j] = "";
                    setParts(next);
                  }}
                />
              ) : (
                <Select
                  value={val || undefined}
                  placeholder={TAG_LABELS[i - 4]}
                  style={{ width: 110 }}
                  size="small"
                  allowClear
                  showSearch
                  options={(tagOptions[["tag","machine","source","domain"][i-4] as keyof SummaryCsvOptions] || []).map((o: string) => ({ value: o, label: o }))}
                  onChange={(v) => {
                    const next = [...parts];
                    next[i] = v;
                    setParts(next);
                  }}
                />
              )}
              <span style={{ color: "#bbb", fontWeight: 600 }}>_</span>
            </span>
          ))}
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
          size="small"
          icon={<ImportOutlined />}
          onClick={handleImport}
          loading={importing}
        >
          导入原始数据文件
        </Button>
        {previewFilename && (
          <span style={{ fontSize: 12, color: "#888", fontFamily: "Consolas, Monaco, monospace" }}>
            文件名预览: {previewFilename}
          </span>
        )}
      </div>

      </div>{/* end top fixed section */}

      {/* Tree panels — fills remaining height */}
      <div
        style={{
          flex: 1,
          display: "flex",
          gap: 12,
          minHeight: 0,
          paddingTop: 12,
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
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span><FolderOpenOutlined style={{ marginRight: 4 }} />原始数据 (data_raw)</span>
            <div style={{ display: "flex", gap: 4 }}>
              <Button size="small" type="link" onClick={() => setRawExpandedKeys(getAllDirKeys(rawTree))}>展开</Button>
              <Button size="small" type="link" onClick={() => setRawExpandedKeys([])}>收起</Button>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={filterFileKeys(checkedRawKeys).length === 0}
                loading={deleting}
                onClick={() => handleDelete("raw")}
              >
                删除选中
              </Button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
            {treeLoading ? (
              <Spin style={{ display: "block", padding: 24 }} />
            ) : (
              <Tree.DirectoryTree
                treeData={toTreeData(rawTree)}
                checkable
                checkedKeys={checkedRawKeys}
                onCheck={(keys) => setCheckedRawKeys(keys as string[])}
                expandedKeys={rawExpandedKeys}
                selectedKeys={rawSelectedKeys}
                onExpand={(keys) => setRawExpandedKeys(keys as string[])}
                onClick={(_e, node) => {
                  const key = node.key as string;
                  if (/\.(csv|xlsx?|xlsm)$/i.test(key)) {
                    setSelectedRawFile(key);
                    setRawSelectedKeys([key]);
                    const found = findSimFile(key, simTree);
                    if (found) {
                      setSimExpandedKeys(found.expandedKeys);
                      setSimSelectedKeys([found.filePath]);
                      setSelectedSimFile(found.filePath);
                    } else {
                      setSelectedSimFile(null);
                      setSimSelectedKeys([]);
                    }
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
              { value: "calAIV", label: "calAIV" },
              { value: "calCableForce", label: "calCableForce" },
              { value: "calEMDCLUT", label: "calEMDCLUT" },
              { value: "calForceRippleLUT", label: "calForceRippleLUT" },
              { value: "calPANoise", label: "calPANoise" },
              { value: "calPRFCLUT", label: "calPRFCLUT" },
              { value: "calRHCDataDOB200wph", label: "calRHCDataDOB200wph" },
              { value: "calRSECNoise", label: "calRSECNoise" },
            ]}
          />
          <Button
            type="primary"
            size="small"
            loading={processing}
            onClick={handleProcessToSim}
            style={{ width: "100%" }}
          >
            &gt;&gt;&gt;
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
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span><ExperimentOutlined style={{ marginRight: 4 }} />仿真数据 (data_sim)</span>
            <div style={{ display: "flex", gap: 4 }}>
              <Button size="small" type="link" onClick={() => setSimExpandedKeys(getAllDirKeys(simTree))}>展开</Button>
              <Button size="small" type="link" onClick={() => setSimExpandedKeys([])}>收起</Button>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={filterFileKeys(checkedSimKeys).length === 0}
                loading={deleting}
                onClick={() => handleDelete("sim")}
              >
                删除选中
              </Button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
            {treeLoading ? (
              <Spin style={{ display: "block", padding: 24 }} />
            ) : (
              <Tree.DirectoryTree
                treeData={toTreeData(simTree)}
                checkable
                checkedKeys={checkedSimKeys}
                onCheck={(keys) => setCheckedSimKeys(keys as string[])}
                onClick={(_e, node) => {
                  const key = node.key as string;
                  if (/\.(csv|xlsx?|xlsm)$/i.test(key)) {
                    setSelectedSimFile(key);
                    setSimSelectedKeys([key]);
                    const found = findRawFile(key, rawTree);
                    if (found) {
                      setRawExpandedKeys(found.expandedKeys);
                      setRawSelectedKeys([found.filePath]);
                      setSelectedRawFile(found.filePath);
                    } else {
                      setSelectedRawFile(null);
                      setRawSelectedKeys([]);
                    }
                  }
                }}
                expandedKeys={simExpandedKeys}
                selectedKeys={simSelectedKeys}
                onExpand={(keys) => setSimExpandedKeys(keys as string[])}
                style={{ fontSize: 13 }}
              />
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
