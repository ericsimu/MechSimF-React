import { Button, Input } from "antd";
import { TagOutlined, FileTextOutlined, UserOutlined, ClockCircleOutlined } from "@ant-design/icons";
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
    <div className="shrink-0 relative z-[1]">
      {editCase ? (
        <div className="px-4 py-3">
          {/* 信息卡片 */}
          <div className="bg-gradient-to-br from-[#f0f4ff] to-[#f8faff] rounded-lg border border-[#e8ecf4] p-4 text-[13px]">
            {/* 第一行：名称 + 创建者 + 创建时间 + 操作按钮 */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
              <Field icon={<TagOutlined />} label="名称">
                {editingCell.id === editCase.id && editingCell.field === "name" ? (
                  <Input size="small" value={editValue}
                    onChange={(e) => onValueChange(e.target.value)}
                    onBlur={() => onSaveEdit(editCase, "name")}
                    onPressEnter={() => onSaveEdit(editCase, "name")}
                    onKeyDown={(e) => e.key === "Escape" && onCancelEdit()}
                    autoFocus className="!text-[13px]" style={{ width: 180 }} />
                ) : (
                  <span className="cursor-pointer px-1 rounded hover:bg-[#e6f4ff] hover:text-[#1677ff] font-medium text-[#333]"
                    onClick={() => onStartEdit(editCase, "name")}>
                    {editCase.name || "-"}
                  </span>
                )}
              </Field>
              <Field icon={<UserOutlined />} label="创建者">
                <span className="text-[#555]">{editCase.create_by}</span>
              </Field>
              <Field icon={<ClockCircleOutlined />} label="创建时间">
                <span className="text-[#555]">{editCase.create_time ? new Date(editCase.create_time).toLocaleString() : "-"}</span>
              </Field>
              <div className="flex gap-1 ml-auto items-center">
                <Button className={btn} size="small" loading={saving} onClick={onSave}>保存</Button>
                <Button className={btn} size="small" onClick={() => onCopy(editCase)}>复制</Button>
                <Button className={btn} size="small" onClick={() => onShare(editCase)}>共享</Button>
                <Button className={btn} size="small" onClick={() => onDelete(editCase)}>删除</Button>
                <Button className={btn} size="small" onClick={onCreateTask}>创建任务</Button>
              </div>
            </div>
            {/* 第二行：描述，独占一行 */}
            <div className="mt-2 pt-2 border-t border-[#e8ecf4]">
              <Field icon={<FileTextOutlined />} label="描述">
                {editingCell.id === editCase.id && editingCell.field === "description" ? (
                  <Input size="small" value={editValue}
                    onChange={(e) => onValueChange(e.target.value)}
                    onBlur={() => onSaveEdit(editCase, "description")}
                    onPressEnter={() => onSaveEdit(editCase, "description")}
                    onKeyDown={(e) => e.key === "Escape" && onCancelEdit()}
                    autoFocus className="!text-[13px]" style={{ width: 300 }} />
                ) : (
                  <span className="cursor-pointer px-1 rounded hover:bg-[#e6f4ff] hover:text-[#1677ff] text-[#555]"
                    onClick={() => onStartEdit(editCase, "description")}>
                    {editCase.description || "-"}
                  </span>
                )}
              </Field>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3">
          <div className="bg-gradient-to-br from-[#f0f4ff] to-[#f8faff] rounded-lg border border-[#e8ecf4] p-4 text-center text-[#999] text-[13px]">请从左侧选择一个用例</div>
        </div>
      )}
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#3b82f6]/60 text-xs shrink-0">{icon}</span>
      <span className="text-[#999] text-xs shrink-0">{label}</span>
      <span>{children}</span>
    </div>
  );
}
