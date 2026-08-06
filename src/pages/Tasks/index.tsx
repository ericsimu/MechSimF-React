import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "@umijs/max";
import { Table, Modal, Button, message } from "antd";
import type { TableColumnsType } from "antd";
import type { FilterValue } from "antd/es/table/interface";
import { queueTasks, deleteTask, cancelTask } from '@/api/index';
import type { SimTask } from '@/types/api';
import { isNil } from '@/utils/isNil';
import { useColumnResize } from '@/hooks/useColumnResize';

interface DiffRow {
  path: string;
  old: string;
  new: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "等待中",
  running: "运行中",
  done: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const STATUS_CLASS: Record<string, string> = {
  done: "bg-[#d1fae5] text-[#065f46]",
  running: "bg-[#dbeafe] text-[#1e40af]",
  pending: "bg-[#fef3c7] text-[#92400e]",
  failed: "bg-[#fee2e2] text-[#991b1b]",
  cancelled: "bg-[#f3f4f6] text-[#6b7280]",
};
const STATUS_DOT: Record<string, string> = {
  done: "#10b981",
  running: "#3b82f6",
  pending: "#f59e0b",
  failed: "#ef4444",
  cancelled: "#9ca3af",
};

// 记住任务表的表头过滤状态（模块级，跨页面切换/组件重挂载保留）
let savedTaskFilters: Record<string, FilterValue | null> = {};
// 记住勾选的任务（跨页面切换保留，导出供导航栏读取）
export let savedTaskSelection: React.Key[] = [];

type FilterOpt = { text: string; value: string | number };

/** 自定义列筛选下拉：纯 HTML 渲染，避免 antd 内置筛选按钮被 Tailwind 影响。 */
function ColumnFilter(props: {
  options: FilterOpt[];
  search?: boolean;
  selectedKeys: React.Key[];
  setSelectedKeys: (keys: React.Key[]) => void;
  confirm: () => void;
  clearFilters?: () => void;
}) {
  const { options, search, selectedKeys, setSelectedKeys, confirm, clearFilters } = props;
  const [q, setQ] = useState("");
  const shown =
    search && q
      ? options.filter((o) => o.text.toLowerCase().includes(q.toLowerCase()))
      : options;

  const toggle = (v: string | number, checked: boolean) =>
    setSelectedKeys(
      checked
        ? [...selectedKeys, v as React.Key]
        : selectedKeys.filter((k) => k !== v),
    );

  return (
    <div style={{ padding: 8, minWidth: 180 }}>
      {search && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索"
          style={{
            width: "100%",
            boxSizing: "border-box",
            marginBottom: 6,
            padding: "3px 6px",
            border: "1px solid #d9d9d9",
            borderRadius: 4,
            fontSize: 12,
            outline: "none",
          }}
        />
      )}
      <div style={{ maxHeight: 240, overflowY: "auto" }}>
        {shown.length === 0 ? (
          <div style={{ color: "#999", fontSize: 12, padding: "4px 0" }}>无选项</div>
        ) : (
          shown.map((o) => (
            <label
              key={String(o.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 0",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={selectedKeys.includes(o.value as React.Key)}
                onChange={(e) => toggle(o.value, e.target.checked)}
              />
              <span>{o.text}</span>
            </label>
          ))
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          marginTop: 8,
          borderTop: "1px solid #f0f0f0",
          paddingTop: 8,
        }}
      >
        <button
          onClick={() => {
            clearFilters?.();
            setQ("");
            confirm();
          }}
          style={{
            background: "transparent",
            color: "#3b82f6",
            border: "none",
            padding: "2px 8px",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          重置
        </button>
        <button
          onClick={() => confirm()}
          style={{
            background: "transparent",
            color: "#3b82f6",
            border: "none",
            padding: "2px 8px",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          确定
        </button>
      </div>
    </div>
  );
}

/** 生成列的自定义 filterDropdown。 */
function makeFilterDropdown(options: FilterOpt[], search = false) {
  return (p: {
    selectedKeys: React.Key[];
    setSelectedKeys: (keys: React.Key[]) => void;
    confirm: () => void;
    clearFilters?: () => void;
  }) => (
    <ColumnFilter
      options={options}
      search={search}
      selectedKeys={p.selectedKeys}
      setSelectedKeys={p.setSelectedKeys}
      confirm={p.confirm}
      clearFilters={p.clearFilters}
    />
  );
}

export default function Tasks() {
  const [tasks, setTasks] = useState<SimTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffRows, setDiffRows] = useState<DiffRow[]>([]);
  const [failInfo, setFailInfo] = useState<{ taskId: number; taskName: string; error: string } | null>(null);
  const [tableFilters, setTableFilters] =
    useState<Record<string, FilterValue | null>>(savedTaskFilters);
  const [selectedRowKeys, setSelectedRowKeys] =
    useState<React.Key[]>(savedTaskSelection);
  const navigate = useNavigate();
  const { colW, resizeHeaderCell } = useColumnResize();

  function updateSelection(keys: React.Key[]) {
    savedTaskSelection = keys;
    setSelectedRowKeys(keys);
  }

  function gotoDataView() {
    if (selectedRowKeys.length === 0) return;
    const ids = selectedRowKeys.map(String).join(",");
    navigate(`/data?ids=${ids}`);
  }

  const loadTasks = useCallback(async () => {
    try {
      const r = await queueTasks();
      if (r.success && r.data) setTasks(r.data);
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    loadTasks().finally(() => setLoading(false));
  }, [loadTasks]);

  useEffect(() => {
    if (tasks.some((t) => t.status === "pending" || t.status === "running")) {
      const timer = setInterval(loadTasks, 3000);
      return () => clearInterval(timer);
    }
  }, [tasks, loadTasks]);

  function showDiff(task: SimTask) {
    if (!task.param_diff) return;
    try {
      const parsed = JSON.parse(task.param_diff);
      const rows: DiffRow[] = [];
      const fmt = (v: unknown): string =>
        isNil(v) ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      const cleanPath = (raw: string) =>
        raw
          .replace(/^root/, "")
          .replace(/\['([^']*)'\]/g, ".$1")
          .replace(/\["([^"]*)"\]/g, ".$1")
          .replace(/^\./, "");
      for (const [changeType, items] of Object.entries(parsed)) {
        if (!items || typeof items !== "object") continue;
        // 只显示参数变更，跳过参数新增/删除
        if (changeType.includes("added") || changeType.includes("removed"))
          continue;
        for (const [path, v] of Object.entries(items as Record<string, any>)) {
          rows.push({
            path: cleanPath(path),
            old: fmt(v.old_value),
            new: fmt(v.new_value),
          });
        }
      }
      setDiffRows(rows);
      setDiffOpen(true);
    } catch {
      /* */
    }
  }

  async function handleDelete(task: SimTask) {
    Modal.confirm({
      title: "确认删除",
      content: `确定要删除任务 #${task.id}「${task.name}」吗？`,
      okText: "确认",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const r = await deleteTask(task.id!);
          if (r.success) {
            message.success("删除成功");
            loadTasks();
          } else message.error(r.message || "删除失败");
        } catch {
          message.error("删除失败");
        }
      },
    });
  }

  async function handleCancel(task: SimTask) {
    Modal.confirm({
      title: "确认取消",
      content: `确定要取消任务 #${task.id}「${task.name}」吗？这将强制终止 MATLAB 进程。`,
      okText: "确认取消",
      cancelText: "返回",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const r = await cancelTask(task.id!);
          if (r.success) {
            message.success("任务已取消");
            loadTasks();
          } else message.error(r.message || "取消失败");
        } catch {
          message.error("取消失败");
        }
      },
    });
  }

  // 各列的去重筛选项，来源于全量任务数据（多列筛选自动叠加为 AND）
  const filterOpts = useMemo(() => {
    const uniq = (field: keyof SimTask, labelMap?: Record<string, string>) => {
      const set = new Set<string | number>();
      tasks.forEach((t) => {
        const v = t[field] as unknown as string | number | null | undefined;
        if (v !== null && v !== undefined && v !== "") set.add(v);
      });
      return Array.from(set)
        .sort((a, b) =>
          typeof a === "number" && typeof b === "number"
            ? a - b
            : String(a).localeCompare(String(b)),
        )
        .map((v) => ({ text: labelMap?.[String(v)] ?? String(v), value: v }));
    };
    return {
      id: uniq("id"),
      name: uniq("name"),
      sys_name: uniq("sys_name"),

      model_version: uniq("model_version"),
      model_productivity: uniq("model_productivity"),
      status: uniq("status", STATUS_LABELS),
    };
  }, [tasks]);

  const columns: TableColumnsType<SimTask> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: colW("id"),
      onHeaderCell: () => resizeHeaderCell("id"),
      filterDropdown: makeFilterDropdown(filterOpts.id, true),
      filteredValue: tableFilters.id ?? null,
      onFilter: (value, r) => r.id === value,
    },
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      width: colW("name"),
      onHeaderCell: () => resizeHeaderCell("name"),
      filterDropdown: makeFilterDropdown(filterOpts.name, true),
      filteredValue: tableFilters.name ?? null,
      onFilter: (value, r) => r.name === value,
    },
    {
      title: "系统",
      dataIndex: "sys_name",
      key: "sys_name",
      width: colW("sys_name"),
      onHeaderCell: () => resizeHeaderCell("sys_name"),
      filterDropdown: makeFilterDropdown(filterOpts.sys_name, true),
      filteredValue: tableFilters.sys_name ?? null,
      onFilter: (value, r) => r.sys_name === value,
      render: (v: string) => v || "-",
    },
    {
      title: "仿真时间",
      dataIndex: "sim_duration",
      key: "sim_duration",
      width: colW("sim_duration"),
      onHeaderCell: () => resizeHeaderCell("sim_duration"),
      render: (_: unknown, r: SimTask) => {
        if (!r.create_time || !r.update_time) return "-";
        const ms = new Date(r.update_time).getTime() - new Date(r.create_time).getTime();
        if (ms <= 0) return "";
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
      },
    },
    {
      title: "版本",
      dataIndex: "model_version",
      key: "model_version",
      width: colW("model_version"),
      onHeaderCell: () => resizeHeaderCell("model_version"),
      filterDropdown: makeFilterDropdown(filterOpts.model_version),
      filteredValue: tableFilters.model_version ?? null,
      onFilter: (value, r) => r.model_version === value,
      render: (v: string) => v || "-",
    },
    {
      title: "产率",
      dataIndex: "model_productivity",
      key: "model_productivity",
      width: colW("model_productivity"),
      onHeaderCell: () => resizeHeaderCell("model_productivity"),
      filterDropdown: makeFilterDropdown(filterOpts.model_productivity),
      filteredValue: tableFilters.model_productivity ?? null,
      onFilter: (value, r) => r.model_productivity === value,
      render: (v: string) => v || "-",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: colW("status"),
      onHeaderCell: () => resizeHeaderCell("status"),
      filterDropdown: makeFilterDropdown(filterOpts.status),
      filteredValue: tableFilters.status ?? null,
      onFilter: (value, r) => r.status === value,
      render: (s: string) => (
        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-[10px] font-medium ${STATUS_CLASS[s] || ""}`}>
          <span className="inline-block w-[6px] h-[6px] rounded-full shrink-0" style={{ background: STATUS_DOT[s] || "#888" }} />
          {STATUS_LABELS[s] || s}
        </span>
      ),
    },
    {
      title: "参数变更",
      dataIndex: "param_diff",
      key: "param_diff",
      width: colW("param_diff"),
      onHeaderCell: () => resizeHeaderCell("param_diff"),
      render: (_: unknown, record: SimTask) =>
        record.param_diff ? (
          <span className="text-[#3b82f6] cursor-pointer hover:underline" style={{ fontWeight: 500 }} onClick={() => showDiff(record)}>
            查看
          </span>
        ) : (
          "-"
        ),
    },
    {
      title: "创建时间",
      dataIndex: "create_time",
      key: "create_time",
      width: colW("create_time"),
      onHeaderCell: () => resizeHeaderCell("create_time"),
      render: (t: string) => (t ? new Date(t).toLocaleString() : "-"),
    },
    {
      title: "操作",
      key: "actions",
      width: colW("actions"),
      onHeaderCell: () => resizeHeaderCell("actions"),
      render: (_: unknown, record: SimTask) => (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <Button type="link" size="small" style={{ fontWeight: 500 }} onClick={() => handleDelete(record)}>
            删除
          </Button>
          {record.status === "failed" && (
            <Button type="link" size="small" style={{ fontWeight: 500 }}
              onClick={() => { setFailInfo({ taskId: record.id!, taskName: record.name, error: record.error }); }}
            >错误</Button>
          )}
          {(record.status === "pending" || record.status === "running") && (
            <Button type="link" size="small" style={{ fontWeight: 500 }}
              onClick={() => handleCancel(record)}
            >取消</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 flex flex-col flex-1 min-h-0">
      <div className="bg-white rounded-lg shadow-sm border border-[#f0f0f0] flex flex-col flex-1 min-h-0 overflow-hidden px-4 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="page-title text-base font-semibold m-0">任务列表</h2>
        <div className="flex gap-2">
          <Button
            type="primary"
            size="small"
            disabled={selectedRowKeys.length === 0}
            onClick={gotoDataView}
          >
            数据查看（{selectedRowKeys.length}）
          </Button>
        </div>
      </div>
      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={false}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => updateSelection(keys as React.Key[]),
          getCheckboxProps: (r) => ({
            disabled: r.status !== "done",
          }),
        }}
        scroll={{ y: 'calc(100vh - 200px)' }}
        locale={{ emptyText: <span className="flex flex-col items-center gap-2 py-8"><span className="text-[#d0d5dd] text-3xl">📋</span><span className="text-[#999] text-xs">暂无数据</span></span> }}
        onChange={(_pagination, filters) => {
          savedTaskFilters = filters; // 持久化到模块级，切换页面后保留
          setTableFilters(filters);
        }}
      />

      <Modal
        title="参数变更详情"
        open={diffOpen}
        onCancel={() => setDiffOpen(false)}
        width={700}
        footer={null}
      >
        {diffRows.length > 0 ? (
          <Table
            size="small"
            pagination={false}
            tableLayout="fixed"
            dataSource={diffRows.map((r, i) => ({ ...r, _key: i }))}
            rowKey="_key"
            columns={[
              { title: "参数路径", dataIndex: "path", className: "font-mono text-xs", onCell: () => ({ style: { wordBreak: "break-all" } }) },
              { title: "原值", dataIndex: "old", className: "text-[#ff4d4f] font-mono text-xs", onCell: () => ({ style: { wordBreak: "break-all" } }) },
              { title: "新值", dataIndex: "new", className: "text-[#52c41a] font-mono text-xs", onCell: () => ({ style: { wordBreak: "break-all" } }) },
            ]}
          />
        ) : (
          <div className="text-center text-[#999] py-10 text-[13px]">无变更</div>
        )}
      </Modal>

      <Modal
        title="错误信息"
        open={!!failInfo}
        onCancel={() => setFailInfo(null)}
        footer={null}
        width={500}
      >
        {failInfo && (
          <div>
            <div className="text-[13px] font-semibold text-[#333] mb-2">任务 #{failInfo.taskId}「{failInfo.taskName}」</div>
            <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-3 text-[13px] text-[#991b1b] whitespace-pre-wrap">{failInfo.error || "未知错误"}</div>
          </div>
        )}
      </Modal>
      </div>
    </div>
  );
};



