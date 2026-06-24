import type { ReactNode } from "react";
import type { DisturbanceDirNode, DisturbanceFile } from "../types/api";

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
  const files: DisturbanceFile[] = value.files || [];
  const nodes: ReactNode[] = [];

  if (Object.keys(dirs).length > 0) {
    nodes.push(
      <div className="whitespace-nowrap" key={`dir-${path}`}>
        <label
          className="flex items-center gap-0.5 px-3 py-0.5 cursor-pointer text-xs transition-colors duration-100 select-none hover:bg-[#e6f4ff]"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="w-3.5 text-center text-[#999] shrink-0 cursor-pointer" onClick={() => onToggle(path)}>
            {expanded[path] ? "▼" : "▶"}
          </span>
          <span>{name}</span>
        </label>
      </div>,
    );
    if (expanded[path]) {
      nodes.push(
        <div className="pl-4" key={`dir-c-${path}`}>
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
        </div>,
      );
    }
  }

  if (files.length > 0) {
    const fileNodes = files.map((f) => (
      <div className="whitespace-nowrap" key={f.path}>
        <div className="flex items-center gap-0.5 px-3 py-0.5 text-xs transition-colors duration-100 select-none hover:bg-[#e6f4ff]">
          <input
            type="checkbox"
            checked={!!checked[f.path]}
            onChange={() => onCheck(f.path)}
            style={{ cursor: "pointer" }}
          />
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
    ));
    nodes.push(
      <div className="pl-2" key={`files-${path}`}>
        {fileNodes}
      </div>,
    );
  }

  return nodes.length > 0 ? <>{nodes}</> : null;
}
