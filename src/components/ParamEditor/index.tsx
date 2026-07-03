type ParamRow = {
  key: string;
  label: string;
  unit: string;
  value: string;
  orig: unknown;
};

interface Group {
  name: string;
  path: string;
  rows: ParamRow[];
}

interface Props {
  groups: Group[];
  dirtyValues: React.MutableRefObject<Map<string, string>>;
  onSave: (g: Group) => void;
  forceUpdate: () => void;
}

export default function ParamEditor({
  groups,
  dirtyValues,
  onSave,
  forceUpdate,
}: Props) {
  return (
    <>
      {groups.map((g) => (
        <div className="mb-4" key={g.path}>
          <div className="text-[13px] font-semibold text-[#333] mb-1 px-2 py-1 bg-[#fafafa] rounded">{g.name}</div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-[11px] px-2.5 py-1 text-left text-[#888] border-b border-[#f0f0f0]">参数名</th>
                <th className="text-[11px] px-2.5 py-1 text-left text-[#888] border-b border-[#f0f0f0]">参数值</th>
                <th className="text-[11px] px-2.5 py-1 text-left text-[#888] border-b border-[#f0f0f0]">单位</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => {
                const dk = `${g.path}|${r.key}`;
                const val = dirtyValues.current.has(dk)
                  ? dirtyValues.current.get(dk)!
                  : String(r.orig ?? "");
                return (
                  <tr key={r.key} className="hover:[&_td]:bg-[#fafafa]">
                    <td className="px-2.5 py-1 text-[13px] border-b border-[#f5f5f5]">
                      {r.key}
                      {r.label ? (
                        <span style={{ color: "#888", marginLeft: 4 }}>
                          ({r.label})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2.5 py-1 text-[13px] border-b border-[#f5f5f5]">
                      <input
                        className="w-full text-[13px] px-2 py-1 border border-[#d9d9d9] rounded outline-none focus:border-[#3b82f6] focus:[box-shadow:0_0_0_2px_rgba(59,130,246,0.1)]"
                        value={val}
                        onChange={(e) => {
                          dirtyValues.current.set(dk, e.target.value);
                          forceUpdate();
                        }}
                        onBlur={() => onSave(g)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            (e.target as HTMLInputElement).blur();
                        }}
                      />
                    </td>
                    <td className="px-2.5 py-1 text-[13px] border-b border-[#f5f5f5]" style={{ color: "#888", fontSize: 12 }}>
                      {r.unit || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
