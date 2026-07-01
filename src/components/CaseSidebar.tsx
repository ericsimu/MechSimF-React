import { Button } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import type { CaseModel } from "../types/api";

interface Props {
  cases: CaseModel[];
  loading: boolean;
  editCase: CaseModel | null;
  onSelect: (c: CaseModel) => void;
  onAdd: () => void;
}

export default function CaseSidebar({
  cases,
  loading,
  editCase,
  onSelect,
  onAdd,
}: Props) {
  return (
    <div className="w-[200px] shrink-0 bg-white border-r border-[#f0f0f0] flex flex-col">
      <div className="flex items-center justify-between h-[48px] px-4 border-b border-[#f0f0f0] bg-[#fafafa]">
        <span className="text-sm font-semibold">用例列表</span>
        <Button className="!min-w-[56px] !h-8 !px-3 !text-[13px] !font-medium !border-none !bg-transparent !text-[#3b82f6] hover:!bg-[rgba(59,130,246,0.08)]" onClick={onAdd}>
          新建
        </Button>
      </div>
      {loading ? (
        <div className="py-6 px-4 text-[13px] text-[#999] text-center">加载中...</div>
      ) : cases.length === 0 ? (
        <div className="py-6 px-4 text-[13px] text-[#999] text-center">暂无用例</div>
      ) : (
        <ul className="list-none m-0 py-1 px-0 flex-1 min-h-0 overflow-y-auto">
          {cases.map((c) => (
            <li
              key={c.id}
              className={`py-2 px-4 cursor-pointer text-[13px] text-[#333] transition-colors duration-100 hover:bg-[#f0f0f0] ${editCase?.id === c.id ? "bg-[#e6f4ff] !text-[#1677ff] font-medium" : ""}`}
              onClick={() => onSelect(c)}
            >
              <span className="flex items-center gap-2 overflow-hidden">
                <FileTextOutlined className="text-[#3b82f6]/40 shrink-0 text-xs" />
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{c.name || "未命名"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
