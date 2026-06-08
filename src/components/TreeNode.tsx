import React from "react";

interface TreeNodeProps {
  name: string;
  value: unknown;
  path: string;
  selPath: string;
  expanded: Record<string, boolean>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isLastLayer(v: unknown): boolean {
  if (!isObject(v)) return false;
  return Object.entries(v)
    .filter(([k]) => k !== "_labels")
    .every(([, cv]) => !isObject(cv));
}

const TreeNode: React.FC<TreeNodeProps> = ({
  name,
  value,
  path,
  selPath,
  expanded,
  onToggle,
  onSelect,
}) => {
  const nested = isObject(value);
  const childLast = isLastLayer(value);

  return (
    <div className="tree-node">
      <label
        className={selPath === path ? "selected" : ""}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(path);
        }}
      >
        {nested && !childLast ? (
          <span
            className="tree-toggle"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(path);
            }}
          >
            {expanded[path] ? "▼" : "▶"}
          </span>
        ) : (
          <span className="tree-toggle" style={{ visibility: "hidden" }}>
            {"▶"}
          </span>
        )}
        <span>{name}</span>
      </label>
      {nested && !childLast && expanded[path] && (
        <div className="tree-children">
          {Object.entries(value)
            .filter(([k]) => k !== "_labels" && k !== "_units" && k !== "ID")
            .map(([k, v]) => (
              <TreeNode
                key={k}
                name={k}
                value={v}
                path={`${path}.${k}`}
                selPath={selPath}
                expanded={expanded}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ))}
        </div>
      )}
    </div>
  );
};

export default TreeNode;
