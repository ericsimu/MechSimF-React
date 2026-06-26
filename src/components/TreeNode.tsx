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
    .filter(([k]) => k !== "_labels" && k !== "_units")
    .every(([, cv]) => !isObject(cv));
}

export default function TreeNode({
  name,
  value,
  path,
  selPath,
  expanded,
  onToggle,
  onSelect,
}: TreeNodeProps) {
  const nested = isObject(value);
  const childLast = isLastLayer(value);
  const isSelected = selPath === path;

  return (
    <div className="whitespace-nowrap">
      <label
        className={`flex items-center gap-0.5 px-3 py-0.5 cursor-pointer text-xs transition-colors duration-100 select-none hover:bg-[#e6f4ff] ${isSelected ? "bg-[#bae0ff] !text-[#1677ff] font-medium" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(path);
        }}
      >
        {nested && !childLast ? (
          <span
            className="w-3.5 text-center text-[#999] shrink-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(path);
            }}
          >
            {expanded[path] ? "▼︎" : "▶︎"}
          </span>
        ) : (
          <span className="w-3.5 text-center shrink-0" style={{ visibility: "hidden" }}>
            {"▶︎"}
          </span>
        )}
        <span>{name}</span>
      </label>
      {nested && !childLast && expanded[path] && (
        <div className="pl-4">
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
}
