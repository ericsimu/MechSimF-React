import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Input, Modal, Table, message } from "antd";
import {
  queueCases,
  addCase,
  updateCase,
  shareCase,
  unshareCase,
  getCaseShares,
  diffCase,
  addTasks,
  runTasks,
} from '@/api/index';
import { getCurrentUser } from '@/utils/user';
import type { CaseModel, AddCaseRequest } from '@/types/api';
import CaseSidebar from '@/components/CaseSidebar';
import CaseDetail from '@/components/CaseDetail';
import ModelTab, { type ModelTabHandle } from '@/components/ModelTab';
import { isNil } from '@/utils/isNil';

// ── Main Component ──
export default function CaseList() {
  // ── Case List State ──
  const [cases, setCases] = useState<CaseModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Edit State ──
  const [editCase, setEditCase] = useState<CaseModel | null>(null);
  const [saving, setSaving] = useState(false);
  const modelTabRef = useRef<ModelTabHandle>(null);

  // ── Inline Edit ──
  const [editingCell, setEditingCell] = useState<{
    id: number | null;
    field: string;
  }>({ id: null, field: "" });
  const [editValue, setEditValue] = useState("");

  // ── Delete ──
  const [deleteTarget, setDeleteTarget] = useState<CaseModel | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Share ──
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCaseId, setShareCaseId] = useState<number | null>(null);
  const [shareUsers, setShareUsers] = useState<string[]>([]);
  const [shareNewUser, setShareNewUser] = useState("");

  // ── Task / Diff ──
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [diffRows, setDiffRows] = useState<
    Array<{ path: string; old: string; new: string }>
  >([]);
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  // ── Load Cases ──
  const loadCases = useCallback(async () => {
    try {
      const r = await queueCases();
      if (r.success && r.data) setCases(r.data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadCases().finally(() => setLoading(false));
  }, [loadCases]);

  // ── Helpers ──
  function buildCaseBody(src: Record<string, any>): AddCaseRequest {
    return {
      name: src.name || "",
      description: src.description || "",
      create_by: src.create_by || getCurrentUser(),
      sys_name: src.sys_name || "",
      model_name: src.model_name || "",
      init_script: src.init_script || "",
      model_verison: src.model_verison || "",
      model_productivity: src.model_productivity || "",
      model_param: src.model_param || "",
      sim_time: src.sim_time ?? null,
      sim_step: src.sim_step ?? null,
      flow_instance_id: src.flow_instance_id || "",
    };
  }

  // ── Open Edit ──
  function openEdit(c: CaseModel) {
    setEditCase(c);
  }

  // ── Save (logic lives in ModelTab; here we only drive the button state) ──
  function handleSaved(body: AddCaseRequest) {
    if (!editCase) return;
    const updated = { ...editCase, ...body };
    setEditCase(updated);
    setCases((prev) => prev.map((c) => (c.id === editCase.id ? updated : c)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await modelTabRef.current?.save();
    } finally {
      setSaving(false);
    }
  }

  // ── Inline Edit ──
  function startInline(c: CaseModel, field: string) {
    setEditingCell({ id: c.id!, field });
    setEditValue((c as any)[field] || "");
  }
  function cancelInline() {
    setEditingCell({ id: null, field: "" });
  }

  async function saveInline(c: CaseModel, field: string) {
    const val = editValue;
    cancelInline();
    if (val === ((c as any)[field] || "")) return;
    const body = buildCaseBody(c);
    (body as any)[field] = val;
    const r = await updateCase(c.id!, body);
    if (r.success) {
      (c as any)[field] = val;
      setCases((prev) => [...prev]);
    }
  }

  // ── Add Case ──
  async function handleAdd() {
    if (!addName.trim()) return;
    setSubmitting(true);
    try {
      const r = await addCase({
        name: addName.trim(),
        description: addDesc.trim(),
        create_by: getCurrentUser(),
        sys_name: "",
        model_name: "",
        init_script: "",
        model_verison: "3X",
        model_productivity: "100WPH",
        model_param: "",
        flow_instance_id: addName.trim(),
      });
      if (r.success) {
        const newId = r.data!.id;
        setAddName("");
        setAddDesc("");
        setAddModalOpen(false);
        const fresh = await queueCases();
        if (fresh.success && fresh.data) {
          setCases(fresh.data);
          const found = fresh.data.find((c) => c.id === newId);
          if (found) openEdit(found);
        }
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : "添加失败");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Copy ──
  async function handleCopy(c: CaseModel) {
    try {
      const r = await addCase({
        ...buildCaseBody(c),
        name: c.name + "_copy",
        create_by: getCurrentUser(),
      });
      if (r.success) await loadCases();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "复制失败");
    }
  }

  // ── Delete ──
  function confirmDelete(c: CaseModel) {
    setDeleteTarget(c);
  }
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const body: any = { ...buildCaseBody(deleteTarget), is_deleted: true };
      const r = await updateCase(deleteTarget.id!, body);
      if (r.success) {
        setDeleteTarget(null);
        if (editCase?.id === deleteTarget.id) setEditCase(null);
        await loadCases();
        message.success("删除成功");
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  // ── Share ──
  async function openShare(c: CaseModel) {
    setShareCaseId(c.id!);
    setShareOpen(true);
    try {
      const r = await getCaseShares(c.id!);
      if (r.success && r.data)
        setShareUsers(r.data.map((s: any) => s.shared_to_user));
    } catch {
      /* */
    }
  }
  async function handleShare() {
    if (!shareNewUser.trim() || !shareCaseId) return;
    const r = await shareCase(shareCaseId, shareNewUser.trim());
    if (r.success) {
      setShareUsers((prev) => [...prev, shareNewUser.trim()]);
      setShareNewUser("");
    }
  }
  async function handleUnshare(user: string) {
    if (!shareCaseId) return;
    const r = await unshareCase(shareCaseId, user);
    if (r.success) setShareUsers((prev) => prev.filter((u) => u !== user));
  }

  // ── Task ──
  async function openTaskModal() {
    await modelTabRef.current?.save(true);
    const body = modelTabRef.current?.getCaseBody();
    if (!editCase || !body) return;
    try {
      const r = await diffCase(editCase.id!, body);
      if (r.success && r.data) {
        const diffDict = r.data as unknown as Record<
          string,
          Record<string, { old_value?: unknown; new_value?: unknown }>
        >;
        function cleanPath(raw: string): string {
          return raw
            .replace(/^root/, "")
            .replace(/\['([^']*)'\]/g, ".$1")
            .replace(/\["([^"]*)"\]/g, ".$1")
            .replace(/^\./, "");
        }
        const rows: Array<{ path: string; old: string; new: string }> = [];
        const fmt = (v: unknown): string =>
          isNil(v)
            ? ""
            : typeof v === "object"
              ? JSON.stringify(v)
              : String(v);
        for (const [changeType, items] of Object.entries(diffDict)) {
          if (!items || typeof items !== "object") continue;
          // 只显示参数变更，跳过参数新增/删除
          if (changeType.includes("added") || changeType.includes("removed"))
            continue;
          for (const [path, v] of Object.entries(items)) {
            rows.push({
              path: cleanPath(path),
              old: fmt(v.old_value),
              new: fmt(v.new_value),
            });
          }
        }
        setDiffRows(rows);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : "获取差异失败");
    }
    setTaskModalOpen(true);
  }

  async function handleRunTask() {
    setTaskSubmitting(true);
    try {
      await modelTabRef.current?.save(true);
      if (!editCase) return;
      const r = await addTasks(editCase.id!);
      if (!r.success) return;
      const taskIds = r.data!.task_ids;
      const runR = await runTasks(taskIds);
      if (runR.success) {
        message.success(`任务已提交 (ID: ${taskIds.join(",")})`);
        setTaskModalOpen(false);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : "任务提交失败");
    } finally {
      setTaskSubmitting(false);
    }
  }

  // ── Render ──
  return (
    <div className="h-[calc(100vh-49px)] flex flex-col overflow-hidden text-[13px] text-[#333]">
      <div className="flex flex-1 overflow-hidden min-h-0">
        <CaseSidebar
          cases={cases}
          loading={loading}
          editCase={editCase}
          onSelect={openEdit}
          onAdd={() => setAddModalOpen(true)}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
          <div className="flex flex-col flex-1 overflow-hidden min-h-0">
            <CaseDetail
              editCase={editCase}
              editingCell={editingCell}
              editValue={editValue}
              onStartEdit={startInline}
              onSaveEdit={saveInline}
              onCancelEdit={cancelInline}
              onValueChange={setEditValue}
              onCopy={handleCopy}
              onShare={openShare}
              onDelete={confirmDelete}
              onCreateTask={openTaskModal}
              onSave={() => handleSave()}
              saving={saving}
            />

            {editCase && (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                <ModelTab
                  key={editCase.id}
                  ref={modelTabRef}
                  caseId={editCase.id!}
                  caseName={editCase.name}
                  caseDescription={editCase.description}
                  onSaved={handleSaved}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        title="创建用例"
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setAddModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="confirm"
            type="primary"
            loading={submitting}
            onClick={handleAdd}
          >
            添加
          </Button>,
        ]}
      >
        <div className="mb-3">
          <label className="block mb-1 text-[13px] font-medium text-[#333]">用例名称</label>
          <Input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="输入用例名称"
          />
        </div>
        <div className="mb-3">
          <label className="block mb-1 text-[13px] font-medium text-[#333]">用例描述</label>
          <Input.TextArea
            value={addDesc}
            onChange={(e) => setAddDesc(e.target.value)}
            rows={3}
            placeholder="输入用例描述"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      </Modal>

      {/* Share Modal */}
      <Modal
        title="共享用例"
        open={shareOpen}
        onCancel={() => setShareOpen(false)}
        footer={null}
      >
        <div className="text-[13px] font-semibold text-[#555] mb-2">已共享用户</div>
        {shareUsers.length > 0 ? (
          <div className="mb-3">
            {shareUsers.map((u) => (
              <div className="flex justify-between items-center px-2 py-1.5 border-b border-[#f0f0f0] text-[13px]" key={u}>
                <span>{u}</span>
                <Button size="small" danger onClick={() => handleUnshare(u)}>
                  移除
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[#999] text-xs mb-3">暂无共享用户</div>
        )}
        <div className="flex gap-2 items-center">
          <Input
            value={shareNewUser}
            onChange={(e) => setShareNewUser(e.target.value)}
            placeholder="输入用户名"
            style={{ flex: 1 }}
          />
          <Button type="primary" onClick={handleShare}>
            添加
          </Button>
        </div>
      </Modal>

      {/* Task Modal */}
      <Modal
        title="创建仿真任务"
        open={taskModalOpen}
        onCancel={() => setTaskModalOpen(false)}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setTaskModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="run"
            type="primary"
            loading={taskSubmitting}
            onClick={handleRunTask}
          >
            运行
          </Button>,
        ]}
      >
        <div className="text-[13px] font-semibold text-[#333] mb-2">参数变更预览</div>
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
          <div className="text-[#999] text-[13px] py-6 text-center">无变更</div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal
        title="确认删除"
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        footer={[
          <Button key="cancel" onClick={() => setDeleteTarget(null)}>
            取消
          </Button>,
          <Button
            key="confirm"
            danger
            type="primary"
            loading={deleting}
            onClick={handleDelete}
          >
            确认
          </Button>,
        ]}
      >
        <p>
          确定要删除用例 <b>{deleteTarget?.name}</b> 吗？
        </p>
        <p className="text-[#999] text-xs">此操作不可撤销</p>
      </Modal>
    </div>
  );
}
