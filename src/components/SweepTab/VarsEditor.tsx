import { useState, useMemo } from "react";
import { Input, Button, Space, AutoComplete } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";

export function VarsEditor({ vars, onChange, allPaths, labels, usedVars }: {
  vars: string[]; onChange: (v: string[]) => void; allPaths: string[]; labels: Record<string, string>; usedVars: Set<string>;
}) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<{ value: string; label: React.ReactNode }[]>([]);
  const [dupeWarn, setDupeWarn] = useState(false);
  const validSet = useMemo(() => new Set(allPaths), [allPaths]);
  const handleSearch = (txt: string) => {
    if (!txt) { setOptions([]); return; }
    const lower = txt.toLowerCase();
    const matches = allPaths.filter((p) => p.toLowerCase().includes(lower)).slice(0, 15);
    // 也匹配已存在的变量（不在 modelInfo 中的）
    for (const v of usedVars) { if (v.toLowerCase().includes(lower) && !matches.includes(v)) matches.push(v); }
    setOptions(matches.map((p) => ({
      value: p,
      label: <span>{p}{labels[p] ? <span className="text-[#999] text-[11px] ml-1">— {labels[p]}</span> : usedVars.has(p) ? <span className="text-[#faad14] text-[11px] ml-1">— 已存在</span> : null}</span>,
    })));
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
      {dupeWarn && <div className="text-[#ff4d4f] text-[11px] mb-1">该变量已在表中存在，不能重复添加</div>}
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
