import { StockOutlined } from "@ant-design/icons";
import type { DisturbanceDirNode } from "../types/api";

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
}: DistTreeNodeProps) {
  const dirs = value.dirs || {};
  const files = value.files || [];
  const hasChildren = Object.keys(dirs).length > 0 || files.length > 0;
  const open = !!expanded[path];

  return (
    <div className="whitespace-nowrap">
      <label
        className="flex items-center gap-0.5 px-3 py-0.5 cursor-pointer text-xs transition-colors duration-100 select-none hover:bg-[#e6f4ff]"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="w-3.5 text-center text-[#999] shrink-0 cursor-pointer"
          onClick={() => hasChildren && onToggle(path)}
        >
          {hasChildren ? (open ? "▼︎" : "▶︎") : ""}
        </span>
        <span
          className="cursor-pointer"
          onClick={() => hasChildren && onToggle(path)}
        >
          {name}
        </span>
      </label>
      {open && hasChildren && (
        <div className="pl-4">
          {Object.entries(dirs).map(([k, sub]) => (
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
                <StockOutlined style={{ fontSize: 11, color: "#3b82f6" }} className="shrink-0" />
                <span
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
