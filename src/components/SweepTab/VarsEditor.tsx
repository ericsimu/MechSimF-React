import { useState, useMemo } from "react";
import { Input, Button, Space, AutoComplete } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";

export function VarsEditor({ vars, onChange, allPaths, usedVars }: {
  vars: string[]; onChange: (v: string[]) => void; allPaths: string[]; usedVars: Set<string>;
}) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<{ value: string }[]>([]);
  const [dupeWarn, setDupeWarn] = useState(false);
  const validSet = useMemo(() => new Set(allPaths), [allPaths]);
  const handleSearch = (txt: string) => {
    if (!txt) { setOptions([]); return; }
    setOptions(allPaths.filter((p) => p.toLowerCase().includes(txt.toLowerCase())).slice(0, 15).map((p) => ({ value: p })));
  };
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const add = () => {
    const t = text.trim();
    if (!t) return;
    if (usedVars.has(t)) { setDupeWarn(true); return; }
    onChange([...vars, t]); setText(""); setOptions([]); setDupeWarn(false);
  };

  return (
    <div style={{ width: 420 }}>
      <div className="max-h-[220px] overflow-y-auto flex flex-col gap-0.5 mb-2 pr-1">
        {vars.length === 0 && <span className="text-[#ff4d4f] text-xs">⚠ 至少需要一个变量</span>}
        {vars.map((v, i) => {
          const isValid = allPaths.length === 0 || validSet.has(v);
          return (
            <div key={i} className="flex items-center gap-1">
              {editingIdx === i ? (
                <Input size="small" value={editText} autoFocus
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={() => {
                    const t = editText.trim();
                    if (t !== "") onChange(vars.map((x, j) => (j === i ? t : x)));
                    setEditingIdx(null);
                  }}
                  onPressEnter={() => { (document.activeElement as HTMLElement)?.blur(); }}
                  onKeyDown={(e) => { if (e.key === "Escape") setEditingIdx(null); }} />
              ) : (
                <span className={`flex-1 text-[12px] break-all cursor-pointer hover:bg-[#f0f4ff] px-1 rounded ${isValid ? "" : "text-[#ff4d4f] line-through"}`}
                  title={!v ? "变量名不能为空" : isValid ? "点击修改" : "此变量在当前系统/版本中不存在"}
                  onClick={() => { setEditingIdx(i); setEditText(v); }}>
                  {v || <span className="text-[#ff4d4f] italic">空</span>}
                  {(!isValid || !v) && <span className="text-[10px] ml-1 text-[#faad14]">⚠</span>}
                </span>
              )}
              <DeleteOutlined className="text-[#ff4d4f] text-[11px] cursor-pointer shrink-0"
                onClick={() => onChange(vars.filter((_, j) => j !== i))} />
            </div>
          );
        })}
      </div>
      {dupeWarn && <div className="text-[#ff4d4f] text-[11px] mb-1">该变量已存在，不能重复添加</div>}
      <Space.Compact style={{ width: "100%" }}>
        <AutoComplete
          options={options}
          onSearch={(val: string) => { setText(val); handleSearch(val); setDupeWarn(false); }}
          onSelect={(val: string) => { setText(val); setOptions([]); }}
          value={text}
          className="flex-1" size="small"
          placeholder="输入变量路径，模糊匹配"
        />
        <Button size="small" type="primary" icon={<PlusOutlined />} onClick={add}>添加</Button>
      </Space.Compact>
    </div>
  );
}
