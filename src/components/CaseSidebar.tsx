import React from "react";
import { Button } from "antd";
import type { CaseModel } from "../types/api";

interface Props {
  cases: CaseModel[];
  loading: boolean;
  editCase: CaseModel | null;
  onSelect: (c: CaseModel) => void;
  onAdd: () => void;
}

const CaseSidebar: React.FC<Props> = ({
  cases,
  loading,
  editCase,
  onSelect,
  onAdd,
}) => (
  <div className="case-sidebar">
    <div className="sidebar-header">
      <span className="sidebar-title">用例列表</span>
      <Button className="btn-create" onClick={onAdd}>
        新建
      </Button>
    </div>
    {loading ? (
      <div className="sidebar-loading">加载中...</div>
    ) : cases.length === 0 ? (
      <div className="sidebar-empty">暂无用例</div>
    ) : (
      <ul className="sidebar-list">
        {cases.map((c) => (
          <li
            key={c.id}
            className={`sidebar-item ${editCase?.id === c.id ? "sidebar-item-active" : ""}`}
            onClick={() => onSelect(c)}
          >
            <span className="sidebar-item-text">{c.name || "未命名"}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default CaseSidebar;
