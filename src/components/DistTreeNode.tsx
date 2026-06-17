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
      <div className="tree-node" key={`dir-${path}`}>
        <label onClick={(e) => e.stopPropagation()}>
          <span className="tree-toggle" onClick={() => onToggle(path)}>
            {expanded[path] ? "▼" : "▶"}
          </span>
          <span>{name}</span>
        </label>
      </div>,
    );
    if (expanded[path]) {
      nodes.push(
        <div className="tree-children" key={`dir-c-${path}`}>
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
      <div className="tree-node" key={f.path}>
        <label onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={!!checked[f.path]}
            onChange={() => onCheck(f.path)}
          />
          <span
            style={{
              cursor: "pointer",
              color: selFile === f.path ? "var(--accent)" : undefined,
            }}
            onClick={() => onLeafClick(f.path)}
          >
            {f.name}
          </span>
        </label>
      </div>
    ));
    nodes.push(
      <div className="tree-files" key={`files-${path}`}>
        {fileNodes}
      </div>,
    );
  }

  return nodes.length > 0 ? <>{nodes}</> : null;
};



