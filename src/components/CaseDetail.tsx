import { Button, Input } from "antd";
import { ToolOutlined, UserOutlined, ClockCircleOutlined } from "@ant-design/icons";
import type { CaseModel } from "../types/api";

interface CellEdit {
  id: number | null;
  field: string;
}

interface Props {
  editCase: CaseModel | null;
  editingCell: CellEdit;
  editValue: string;
  onStartEdit: (c: CaseModel, field: string) => void;
  onSaveEdit: (c: CaseModel, field: string) => void;
  onCancelEdit: () => void;
  onValueChange: (v: string) => void;
  onCopy: (c: CaseModel) => void;
  onShare: (c: CaseModel) => void;
  onDelete: (c: CaseModel) => void;
  onCreateTask: () => void;
  onSave: () => void;
  saving: boolean;
}

const btn = "!text-[#3b82f6] !border-none !bg-transparent !font-medium !px-2 !shadow-none hover:!bg-[rgba(59,130,246,0.08)]";

export default function CaseDetail({
  editCase, editingCell, editValue,
  onStartEdit, onSaveEdit, onCancelEdit, onValueChange,
  onCopy, onShare, onDelete, onCreateTask, onSave, saving,
}: Props) {
  return (
    <div className="shrink-0">
      {editCase ? (
        <div className="px-4 py-3">
          <div className="flex items-center gap-4 rounded-xl border border-[#dce3f0] shadow-sm px-5 py-3 bg-gradient-to-r from-[#f8fafd] via-white to-[#f8fafd]">
            {/* 左侧色块 + 名称 */}
            <div className="flex items-center gap-3 min-w-0 flex-[2]">
              <span className="w-7 h-7 rounded-lg bg-[#3b82f6] flex items-center justify-center shrink-0">
                <ToolOutlined style={{ color: "#fff", fontSize: 14 }} />
              </span>
              <div className="min-w-0">
                <div>
                  <div className="flex items-start gap-2.5 min-w-0">
                    {editingCell.id === editCase.id && editingCell.field === "name" ? (
                      <Input size="small" value={editValue}
                        onChange={(e) => onValueChange(e.target.value)}
                        onBlur={() => onSaveEdit(editCase, "name")}
                        onPressEnter={() => onSaveEdit(editCase, "name")}
                        onKeyDown={(e) => e.key === "Escape" && onCancelEdit()}
                        autoFocus className="!text-[13px] shrink-0" style={{ width: 180 }} />
                    ) : (
                      <strong className="cursor-pointer px-1.5 -mx-1.5 py-0.5 rounded-md text-[15px] text-[#111] hover:bg-[#f0f4ff] transition-colors font-semibold shrink-0"
                        onClick={() => onStartEdit(editCase, "name")}>
                        {editCase.name || "未命名"}
                      </strong>
                    )}
                    <span className="text-[#d0d5e0] shrink-0 select-none">|</span>
                    {editingCell.id === editCase.id && editingCell.field === "description" ? (
                      <Input size="small" value={editValue}
                        onChange={(e) => onValueChange(e.target.value)}
                        onBlur={() => onSaveEdit(editCase, "description")}
                        onPressEnter={() => onSaveEdit(editCase, "description")}
                        onKeyDown={(e) => e.key === "Escape" && onCancelEdit()}
                        autoFocus className="!text-[13px]" style={{ width: 260 }} />
                    ) : (
                      <span className={`cursor-pointer px-1.5 -mx-1.5 py-0.5 rounded-md text-[13px] hover:bg-[#f0f4ff] transition-colors min-w-0 break-words ${!editCase.description ? "italic text-[#b0b8cc]" : "text-[#666]"}`}
                        onClick={() => onStartEdit(editCase, "description")}>
                        {editCase.description || "添加描述…"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-[#a0a8bc] mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <UserOutlined style={{ fontSize: 10 }} /> {editCase.create_by || "-"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ClockCircleOutlined style={{ fontSize: 10 }} /> {editCase.create_time ? new Date(editCase.create_time).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* 右侧按钮 */}
            <div className="flex items-center gap-0.5 shrink-0">
              <Button className={btn} size="small" loading={saving} onClick={onSave}>保存</Button>
              <Button className={btn} size="small" onClick={() => onCopy(editCase)}>复制</Button>
              <Button className={btn} size="small" onClick={() => onShare(editCase)}>共享</Button>
              <Button className={btn} size="small" onClick={() => onDelete(editCase)}>删除</Button>
              <Button className={btn} size="small" onClick={onCreateTask}>创建任务</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 text-center text-[#999] text-[13px]">请从左侧选择一个用例</div>
      )}
    </div>
  );
}
