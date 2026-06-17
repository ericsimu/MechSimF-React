import DistTreeNode from "./DistTreeNode";
import type { DisturbanceDirNode, DisturbanceColumn } from "../types/api";

interface Props {
  leftWidth: number;
  disturbEntries: [string, any][];
  disturbChecked: Record<string, boolean>;
  disturbExpanded: Record<string, boolean>;
  selDisturbFile: string;
  onToggle: (path: string) => void;
  onCheck: (path: string) => void;
  onLeafClick: (path: string) => void;
  disturbTree: DisturbanceDirNode;
  disturbColumns: DisturbanceColumn[];
  disturbVisible: Record<string, boolean>;
  onToggleVisible: (name: string) => void;
  chartRef: React.RefObject<HTMLDivElement | null>;
  startResizeLeft: (e: React.MouseEvent) => void;
}

export default function DisturbTab({
  leftWidth,
  disturbEntries,
  disturbChecked,
  disturbExpanded,
  selDisturbFile,
  onToggle,
  onCheck,
  onLeafClick,
  disturbTree,
  disturbColumns,
  disturbVisible,
  onToggleVisible,
  chartRef,
  startResizeLeft,
}: Props) {
  return (
    <div className="edit-body">
      <div className="edit-left" style={{ width: leftWidth }}>
        {disturbEntries.map(([k, v]) => (
          <DistTreeNode
            key={k}
            name={k}
            value={v}
            path={k}
            checked={disturbChecked}
            expanded={disturbExpanded}
            selFile={selDisturbFile}
            onToggle={onToggle}
            onCheck={onCheck}
            onLeafClick={onLeafClick}
          />
        ))}
        {(disturbTree.files?.length ?? 0) > 0 && (
          <>
            {disturbTree.files!.map((f) => (
              <div className="tree-node" key={f.path}>
                <label onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={!!disturbChecked[f.path]}
                    onChange={() => onCheck(f.path)}
                  />
                  <span
                    style={{
                      cursor: "pointer",
                      color:
                        selDisturbFile === f.path
                          ? "#3b82f6"
                          : undefined,
                    }}
                    onClick={() => onLeafClick(f.path)}
                  >
                    {f.name}
                  </span>
                </label>
              </div>
            ))}
          </>
        )}
      </div>
      <div
        className="h-resize-handle"
        onMouseDown={startResizeLeft}
      />
      <div className="edit-right">
        {disturbColumns.length > 0 && (
          <>
            <div ref={chartRef} className="chart-container" />
            <div className="chart-legend">
              {disturbColumns.map((c, i) => (
                <label key={c.name} className="chart-legend-item">
                  <input
                    type="checkbox"
                    checked={disturbVisible[c.name] !== false}
                    onChange={() => onToggleVisible(c.name)}
                  />
                  <span
                    className="legend-dot"
                    style={{
                      backgroundColor: `hsl(${(i * 60) % 360},70%,50%)`,
                    }}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </>
        )}
        {disturbColumns.length === 0 && (
          <div className="edit-right-empty">
            点击左侧文件查看扰动数据
          </div>
        )}
      </div>
    </div>
  );
}
