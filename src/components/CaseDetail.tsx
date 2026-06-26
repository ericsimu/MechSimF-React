import { Button, Input } from "antd";
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

export default function CaseDetail({
  editCase,
  editingCell,
  editValue,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onValueChange,
  onCopy,
  onShare,
  onDelete,
  onCreateTask,
  onSave,
  saving,
}: Props) {
  return (
    <div className="shrink-0 bg-white">
      <div className="flex justify-between items-center h-[48px] px-4 border-b border-[#f0f0f0] bg-[#fafafa]">
        <h2 className="text-[15px] font-semibold m-0">用例详情</h2>
      </div>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left font-semibold border-b border-[#f0f0f0] text-[#666] text-xs">名称</th>
            <th className="px-4 py-2 text-left font-semibold border-b border-[#f0f0f0] text-[#666] text-xs">描述</th>
            <th className="px-4 py-2 text-left font-semibold border-b border-[#f0f0f0] text-[#666] text-xs">创建者</th>
            <th className="px-4 py-2 text-left font-semibold border-b border-[#f0f0f0] text-[#666] text-xs">创建时间</th>
            <th className="px-4 py-2 text-left font-semibold border-b border-[#f0f0f0] text-[#666] text-xs">操作</th>
          </tr>
        </thead>
        <tbody>
          {editCase ? (
            <tr>
              <td className="px-4 py-2 border-b border-[#fafafa]">
                {editingCell.id === editCase.id &&
                editingCell.field === "name" ? (
                  <Input
                    size="small"
                    value={editValue}
                    onChange={(e) => onValueChange(e.target.value)}
                    onBlur={() => onSaveEdit(editCase, "name")}
                    onPressEnter={() => onSaveEdit(editCase, "name")}
                    onKeyDown={(e) => e.key === "Escape" && onCancelEdit()}
                    autoFocus
                    className="w-full !px-1.5 !py-0.5 !text-[13px]"
                  />
                ) : (
                  <span
                    className="cursor-pointer inline-block min-w-[40px] px-1 py-0.5 rounded-sm transition-colors hover:bg-[#e6f4ff] hover:text-[#1677ff]"
                    onClick={() => onStartEdit(editCase, "name")}
                  >
                    {editCase.name || "-"}
                  </span>
                )}
              </td>
              <td className="px-4 py-2 border-b border-[#fafafa]">
                {editingCell.id === editCase.id &&
                editingCell.field === "description" ? (
                  <Input
                    size="small"
                    value={editValue}
                    onChange={(e) => onValueChange(e.target.value)}
                    onBlur={() => onSaveEdit(editCase, "description")}
                    onPressEnter={() => onSaveEdit(editCase, "description")}
                    onKeyDown={(e) => e.key === "Escape" && onCancelEdit()}
                    autoFocus
                    className="w-full !px-1.5 !py-0.5 !text-[13px]"
                  />
                ) : (
                  <span
                    className="cursor-pointer inline-block min-w-[40px] px-1 py-0.5 rounded-sm transition-colors hover:bg-[#e6f4ff] hover:text-[#1677ff]"
                    onClick={() => onStartEdit(editCase, "description")}
                  >
                    {editCase.description || "-"}
                  </span>
                )}
              </td>
              <td className="px-4 py-2 border-b border-[#fafafa]">{editCase.create_by}</td>
              <td className="px-4 py-2 border-b border-[#fafafa]">
                {editCase.create_time
                  ? new Date(editCase.create_time).toLocaleString()
                  : "-"}
              </td>
              <td className="px-4 py-2 border-b border-[#fafafa]">
                <div className="flex gap-1 items-center">
                  <Button
                    className="!text-[#3b82f6] !border-none !bg-transparent !font-medium !px-2 !shadow-none hover:!bg-[rgba(59,130,246,0.08)]"
                    size="small"
                    loading={saving}
                    onClick={onSave}
                  >
                    保存
                  </Button>
                  <Button
                    className="!text-[#3b82f6] !border-none !bg-transparent !font-medium !px-2 !shadow-none hover:!bg-[rgba(59,130,246,0.08)]"
                    size="small"
                    onClick={() => onCopy(editCase)}
                  >
                    复制
                  </Button>
                  <Button
                    className="!text-[#3b82f6] !border-none !bg-transparent !font-medium !px-2 !shadow-none hover:!bg-[rgba(59,130,246,0.08)]"
                    size="small"
                    onClick={() => onShare(editCase)}
                  >
                    共享
                  </Button>
                  <Button
                    className="!text-[#3b82f6] !border-none !bg-transparent !font-medium !px-2 !shadow-none hover:!bg-[rgba(59,130,246,0.08)]"
                    size="small"
                    onClick={() => onDelete(editCase)}
                  >
                    删除
                  </Button>
                                    <Button
                    className="!text-[#3b82f6] !border-none !bg-transparent !font-medium !px-2 !shadow-none hover:!bg-[rgba(59,130,246,0.08)]"
                    size="small"
                    onClick={onCreateTask}
                  >
                    创建任务
                  </Button>
                </div>
              </td>
            </tr>
          ) : (
            <tr>
              <td colSpan={5} className="text-center text-[#999] py-10">
                请从左侧选择一个用例
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
