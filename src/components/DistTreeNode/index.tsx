import { StockOutlined, ControlOutlined, FundOutlined } from "@ant-design/icons";
import type { DisturbanceDirNode } from '@/types/api';

function getFileIcon(fpath: string): { icon: React.ReactNode; color: string } {
  const fname = fpath.split(/[/\\]/).pop() || "";
  const parts = fname.split("_");
  const ch = (parts[7] || "").toLowerCase();
  if (ch === "s") return { icon: <ControlOutlined style={{ fontSize: 11, color: "#f59e0b" }} />, color: "#f59e0b" };
  if (ch === "t") return { icon: <StockOutlined style={{ fontSize: 11, color: "#3b82f6" }} />, color: "#3b82f6" };
  if (ch === "f") return { icon: <FundOutlined style={{ fontSize: 11, color: "#10b981" }} />, color: "#10b981" };
  return { icon: <StockOutlined style={{ fontSize: 11, color: "#3b82f6" }} />, color: "#3b82f6" };
}

interface DistTreeNodeProps {
  name: string;
  value: DisturbanceDirNode;
  path: string;
  checked: Record<string, boolean>;
  expanded: Record<string, boolean>;
  selFile: string;
  onToggle: (path: string) => void;
  onCheck: (path: string) => void;
  onLeafClick: (path: string) => void;
  folders?: string[] | null; // null=不过滤, []=全隐藏, ["RS"]=只显示RS
}

export default function DistTreeNode({
  name,
  value,
  path,
  checked,
  expanded,
  selFile,
  onToggle,
  onCheck,
  onLeafClick,
  folders,
}: DistTreeNodeProps) {
  const dirs = value.dirs || {};
  const files = value.files || [];
  const hasChildren = Object.keys(dirs).length > 0 || files.length > 0;
  const open = !!expanded[path];

  return (
    <div className="whitespace-nowrap">
      <label
        className="flex items-center gap-0.5 px-3 py-0.5 cursor-pointer text-xs transition-colors duration-100 select-none hover:bg-[#e6f4ff]"
        onClick={() => hasChildren && onToggle(path)}
      >
        <span className="w-3.5 text-center shrink-0 inline-flex items-center justify-center">
          {hasChildren ? (
            <svg width="8" height="8" viewBox="0 0 8 8" className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
              <path d="M2.5 1L5.5 4L2.5 7" stroke="#999" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </span>
        <span>{name}</span>
      </label>
      {open && hasChildren && (
        <div className="pl-4">
          {Object.entries(dirs)
            .filter(([k]) => !folders || folders.includes(k))
            .map(([k, sub]) => (
            <DistTreeNode
              key={k}
              name={k}
              value={sub}
              path={path ? `${path}/${k}` : k}
              checked={checked}
              expanded={expanded}
              selFile={selFile}
              onToggle={onToggle}
              onCheck={onCheck}
              onLeafClick={onLeafClick}
              folders={null}
            />
          ))}
          {files.map((f) => (
            <div className="whitespace-nowrap" key={f.path}>
              <div className="flex items-center gap-0.5 px-3 py-0.5 text-xs transition-colors duration-100 select-none hover:bg-[#e6f4ff]">
                <input
                  type="checkbox"
                  checked={!!checked[f.path]}
                  onChange={() => onCheck(f.path)}
                  style={{ cursor: "pointer" }}
                />
                <span className="shrink-0">{getFileIcon(f.path).icon}</span>
                <span
                  title={f.name}
                  style={{
                    cursor: "pointer",
                    color: selFile === f.path ? "#3b82f6" : undefined,
                  }}
                  onClick={() => onLeafClick(f.path)}
                >
                  {f.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
