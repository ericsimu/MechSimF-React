import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Table, Modal, Button, message } from "antd";
import type { TableColumnsType } from "antd";
import { queueTasks, deleteTask, cancelTask } from "../api/index";
import type { SimTask } from "../types/api";
import { isNil } from "../utils/isNil";

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

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<SimTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffRows, setDiffRows] = useState<DiffRow[]>([]);
  const navigate = useNavigate();

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
        const prefix = changeType.includes("added")
          ? "+ "
          : changeType.includes("removed")
            ? "- "
            : "";
        for (const [path, v] of Object.entries(items as Record<string, any>)) {
          rows.push({
            path: prefix + cleanPath(path),
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

  const columns: TableColumnsType<SimTask> = [
    { title: "ID", dataIndex: "id", key: "id" },
    { title: "名称", dataIndex: "name", key: "name" },
    {
      title: "系统",
      dataIndex: "sys_name",
      key: "sys_name",
      render: (v: string) => v || "-",
    },
    {
      title: "模型",
      dataIndex: "model_name",
      key: "model_name",
      render: (v: string) => v || "-",
    },
    {
      title: "版本",
      dataIndex: "model_version",
      key: "model_version",
      render: (v: string) => v || "-",
    },
    {
      title: "产率",
      dataIndex: "model_productivity",
      key: "model_productivity",
      render: (v: string) => v || "-",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (s: string) => (
        <span className={`dv-status status-${s}`}>{STATUS_LABELS[s] || s}</span>
      ),
    },
    {
      title: "参数变更",
      dataIndex: "param_diff",
      key: "param_diff",
      render: (_: unknown, record: SimTask) =>
        record.param_diff ? (
          <span className="task-id-link" onClick={() => showDiff(record)}>
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
      render: (t: string) => (t ? new Date(t).toLocaleString() : "-"),
    },
    {
      title: "操作",
      key: "actions",
      render: (_: unknown, record: SimTask) => (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/mechsim/data/${record.id}`)}
          >
            详情
          </Button>
          {(record.status === "pending" || record.status === "running") && (
            <Button
              type="link"
              size="small"
              onClick={() => handleCancel(record)}
            >
              取消
            </Button>
          )}
          <Button type="link" size="small" onClick={() => handleDelete(record)}>
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="tasks-page">
      <div className="page-header">
        <h2>任务列表</h2>
      </div>
      <div className="tasks-table-wrap">
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
          locale={{ emptyText: "暂无数据" }}
        />
      </div>

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
            dataSource={diffRows.map((r, i) => ({ ...r, _key: i }))}
            rowKey="_key"
            columns={[
              { title: "参数路径", dataIndex: "path" },
              { title: "原值", dataIndex: "old" },
              { title: "新值", dataIndex: "new" },
            ]}
          />
        ) : (
          <div className="diff-empty">无变更</div>
        )}
      </Modal>
    </div>
  );
};

export default Tasks;
