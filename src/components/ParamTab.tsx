import TreeNode from "./TreeNode";
import ParamEditor from "./ParamEditor";

type ParamRow = {
  key: string;
  label: string;
  unit: string;
  value: string;
  orig: unknown;
};

interface ParamEditGroup {
  name: string;
  path: string;
  rows: ParamRow[];
}

interface Props {
  leftWidth: number;
  paramEntries: [string, any][];
  selParamPath: string;
  paramExpanded: Record<string, boolean>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  paramEditGroups: ParamEditGroup[];
  dirtyValues: React.MutableRefObject<Map<string, string>>;
  onSave: (group: ParamEditGroup) => void;
  onForceUpdate: () => void;
  startResizeLeft: (e: React.MouseEvent) => void;
}

export default function ParamTab({
  leftWidth,
  paramEntries,
  selParamPath,
  paramExpanded,
  onToggle,
  onSelect,
  paramEditGroups,
  dirtyValues,
  onSave,
  onForceUpdate,
  startResizeLeft,
}: Props) {
  return (
    <div className="edit-body">
      <div className="edit-left" style={{ width: leftWidth }}>
        {paramEntries.map(([k, v]) => (
          <TreeNode
            key={k}
            name={k}
            value={v}
            path={k}
            selPath={selParamPath}
            expanded={paramExpanded}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
        {paramEntries.length === 0 && (
          <div className="tree-empty">暂无参数数据</div>
        )}
      </div>
      <div
        className="h-resize-handle"
        onMouseDown={startResizeLeft}
      />
      <div className="edit-right">
        {paramEditGroups.length > 0 && (
          <ParamEditor
            groups={paramEditGroups}
            dirtyValues={dirtyValues}
            onSave={onSave}
            forceUpdate={onForceUpdate}
          />
        )}
      </div>
    </div>
  );
}
