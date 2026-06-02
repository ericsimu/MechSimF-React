import React from 'react'
import { Button, Input } from 'antd'
import type { CaseModel } from '../types/api'

interface CellEdit {
  id: number | null
  field: string
}

interface Props {
  editCase: CaseModel | null
  editingCell: CellEdit
  editValue: string
  onStartEdit: (c: CaseModel, field: string) => void
  onSaveEdit: (c: CaseModel, field: string) => void
  onCancelEdit: () => void
  onValueChange: (v: string) => void
  onCopy: (c: CaseModel) => void
  onShare: (c: CaseModel) => void
  onDelete: (c: CaseModel) => void
}

const CaseDetail: React.FC<Props> = ({
  editCase, editingCell, editValue,
  onStartEdit, onSaveEdit, onCancelEdit, onValueChange,
  onCopy, onShare, onDelete,
}) => (
  <div className="case-list">
    <div className="page-header"><h2>用例详情</h2></div>
    <table>
      <thead><tr><th>名称</th><th>描述</th><th>创建者</th><th>创建时间</th><th>操作</th></tr></thead>
      <tbody>
        {editCase ? (
          <tr>
            <td>
              {editingCell.id === editCase.id && editingCell.field === 'name' ? (
                <Input size="small" value={editValue}
                  onChange={e => onValueChange(e.target.value)}
                  onBlur={() => onSaveEdit(editCase, 'name')}
                  onPressEnter={() => onSaveEdit(editCase, 'name')}
                  onKeyDown={e => e.key === 'Escape' && onCancelEdit()}
                  autoFocus className="inline-input"
                />
              ) : (
                <span className="editable-cell" onClick={() => onStartEdit(editCase, 'name')}>{editCase.name || '-'}</span>
              )}
            </td>
            <td>
              {editingCell.id === editCase.id && editingCell.field === 'description' ? (
                <Input size="small" value={editValue}
                  onChange={e => onValueChange(e.target.value)}
                  onBlur={() => onSaveEdit(editCase, 'description')}
                  onPressEnter={() => onSaveEdit(editCase, 'description')}
                  onKeyDown={e => e.key === 'Escape' && onCancelEdit()}
                  autoFocus className="inline-input"
                />
              ) : (
                <span className="editable-cell" onClick={() => onStartEdit(editCase, 'description')}>{editCase.description || '-'}</span>
              )}
            </td>
            <td>{editCase.create_by}</td>
            <td>{editCase.create_time ? new Date(editCase.create_time).toLocaleString() : '-'}</td>
            <td>
              <div className="actions-cell">
                <Button className="btn-outline" size="small" onClick={() => onCopy(editCase)}>复制</Button>
                <Button className="btn-outline" size="small" onClick={() => onShare(editCase)}>共享</Button>
                <Button className="btn-outline" size="small" onClick={() => onDelete(editCase)}>删除</Button>
              </div>
            </td>
          </tr>
        ) : (
          <tr><td colSpan={5} className="empty">请从左侧选择一个用例</td></tr>
        )}
      </tbody>
    </table>
  </div>
)

export default CaseDetail
