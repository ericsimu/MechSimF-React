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
    <div className="flex-1 flex overflow-hidden min-h-0">
      <div className="shrink-0 overflow-y-auto overflow-x-hidden box-border border-r border-[#f0f0f0] bg-[#fafafa] pb-3 min-h-0" style={{ width: leftWidth }}>
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
          <div className="px-4 py-2 text-[#999] text-xs">暂无参数数据</div>
        )}
      </div>
      <div
        className="w-1 bg-[#f0f0f0] cursor-col-resize shrink-0 border-l border-r border-[#e8e8e8] transition-colors hover:bg-[#d9d9d9]"
        onMouseDown={startResizeLeft}
      />
      <div className="flex-1 overflow-y-auto overflow-x-hidden box-border px-4 py-3 min-w-0 min-h-0">
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
