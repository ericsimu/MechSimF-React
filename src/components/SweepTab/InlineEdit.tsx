import { useState } from "react";
import { Input } from "antd";
import { EditOutlined } from "@ant-design/icons";

export function InlineEdit({
  value, isEditing, onStart, onSave, placeholder, width = 140,
}: {
  value: string; isEditing: boolean; onStart: () => void;
  onSave: (v: string) => void; placeholder?: string; width?: number;
}) {
  const [text, setText] = useState(value);
  if (isEditing) {
    return (
      <Input size="small" value={text} autoFocus style={{ width }}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onSave(text)}
        onPressEnter={() => onSave(text)}
        onKeyDown={(e) => { if (e.key === "Escape") onSave(value); }} />
    );
  }
  return (
    <div onClick={() => { setText(value); onStart(); }}
      className="cursor-pointer px-1 py-0.5 rounded hover:bg-[#e6f4ff] min-h-[22px] text-[13px] flex items-center gap-1 group">
      {value || <span className="text-[#d9d9d9]">{placeholder ?? "-"}</span>}
      <EditOutlined className="text-[11px] text-[#bfbfbf] opacity-0 group-hover:opacity-100" />
    </div>
  );
}
