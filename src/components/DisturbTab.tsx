import { StockOutlined } from "@ant-design/icons";
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
    <div className="flex-1 flex overflow-hidden min-h-0">
      <div className="shrink-0 overflow-y-auto overflow-x-hidden box-border border-r border-[#f0f0f0] bg-white pb-3 min-h-0" style={{ width: leftWidth }}>
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
              <div className="whitespace-nowrap" key={f.path}>
                <div className="flex items-center gap-0.5 px-3 py-0.5 text-xs transition-colors duration-100 select-none hover:bg-[#e6f4ff]">
                  <input
                    type="checkbox"
                    checked={!!disturbChecked[f.path]}
                    onChange={() => onCheck(f.path)}
                    style={{ cursor: "pointer" }}
                  />
                  <StockOutlined style={{ fontSize: 11, color: "#3b82f6" }} className="shrink-0" />
                  <span
                    style={{
                      cursor: "pointer",
                      color: selDisturbFile === f.path ? "#3b82f6" : undefined,
                    }}
                    onClick={() => onLeafClick(f.path)}
                  >
                    {f.name}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      <div
        className="w-1 bg-[#f0f0f0] cursor-col-resize shrink-0 border-l border-r border-[#f0f0f0] transition-colors hover:bg-[#d9d9d9]"
        onMouseDown={startResizeLeft}
      />
      <div className="flex-1 overflow-y-auto overflow-x-hidden box-border px-4 py-3 min-w-0 min-h-0">
        {disturbColumns.length > 0 && (
          <>
            <div ref={chartRef} className="mb-2" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-1.5 py-1.5 text-xs">
              {disturbColumns.map((c, i) => (
                <label key={c.name} className="inline-flex items-center gap-1 cursor-pointer select-none text-[#555] hover:line-through">
                  <input
                    type="checkbox"
                    checked={disturbVisible[c.name] !== false}
                    onChange={() => onToggleVisible(c.name)}
                  />
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
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
