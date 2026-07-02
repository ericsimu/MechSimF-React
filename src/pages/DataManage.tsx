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
} from "@ant-design/icons";
import type { DataNode } from "antd/es/tree";
import {
  uploadRawData,
  importRawData,
  queueDisturbances,
  queueDataSim,
  processToSim,
  fetchSummaryCsvOptions,
  deleteDataFiles,
} from "../api/index";
import type { DisturbanceDirNode, SummaryCsvOptions } from "../types/api";

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
): { simPath: string; expandedKeys: string[] } | null {
  const norm = rawPath.replace(/\\/g, "/");
  const idx = norm.indexOf("data_raw/");
  if (idx < 0) return null;
  const rel = norm.slice(idx + "data_raw/".length); // "DY/RS/BM/Controller/file.csv"
  const segs = rel.split("/");
  const dirs = segs.slice(0, -1);
  const filename = segs[segs.length - 1];

  // Walk sim tree by directory segments
  let node = simTree;
  for (const d of dirs) {
    node = node?.dirs?.[d] ?? null;
    if (!node) return null;
  }
  const simFile = node?.files?.find((f) => f.name === filename);
  if (!simFile) return null;

  // Build expanded keys from directory segments
  const expandedKeys: string[] = [];
  for (let i = 0; i < dirs.length; i++) {
    expandedKeys.push(dirs.slice(0, i + 1).join("/"));
  }
  return { simPath: simFile.path, expandedKeys };
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

  const [parts, setParts] = useState<string[]>(Array(8).fill(""));
  const [version, setVersion] = useState("00.00.99");
  const [ts, setTs] = useState(nowTimestamp());

  const [importing, setImporting] = useState(false);
  const [processMethod, setProcessMethod] = useState("calDiffNoise");
  const [selectedRawFile, setSelectedRawFile] = useState<string | null>(null);
  const [selectedSimFile, setSelectedSimFile] = useState<string | null>(null);
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
        queueDisturbances(),
        queueDataSim(),
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
          const simRes = await queueDataSim();
          if (simRes.success) {
            const freshTree = simRes.data ?? null;
            setSimTree(freshTree);
            const found = findSimFile(selectedRawFile, freshTree);
            if (found) {
              setSimExpandedKeys(found.expandedKeys);
              setSimSelectedKeys([found.simPath]);
              setSelectedSimFile(found.simPath);
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
          gap: 12,
        }}
      >
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
            点击或拖拽CSV格式的原始数据文件到此区域上传
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
            <span>原始数据 (data_raw)</span>
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
          <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
            {treeLoading ? (
              <Spin style={{ display: "block", padding: 24 }} />
            ) : (
              <Tree.DirectoryTree
                treeData={toTreeData(rawTree)}
                checkable
                checkedKeys={checkedRawKeys}
                onCheck={(keys) => setCheckedRawKeys(keys as string[])}
                onClick={(e, node) => {
                  const key = node.key as string;
                  if (/\.(csv|xlsx?|xlsm)$/i.test(key)) {
                    setSelectedRawFile(key);
                    const found = findSimFile(key, simTree);
                    if (found) {
                      setSimExpandedKeys(found.expandedKeys);
                      setSimSelectedKeys([found.simPath]);
                      setSelectedSimFile(found.simPath);
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
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>仿真数据 (data_sim)</span>
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
          <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
            {treeLoading ? (
              <Spin style={{ display: "block", padding: 24 }} />
            ) : (
              <Tree.DirectoryTree
                treeData={toTreeData(simTree)}
                checkable
                checkedKeys={checkedSimKeys}
                onCheck={(keys) => setCheckedSimKeys(keys as string[])}
                onClick={(e, node) => {
                  const key = node.key as string;
                  if (/\.(csv|xlsx?|xlsm)$/i.test(key)) {
                    setSelectedSimFile(key);
                    setSelectedRawFile(null);
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
