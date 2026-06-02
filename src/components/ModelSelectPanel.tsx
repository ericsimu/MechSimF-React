import React from 'react'
import { Select, Input, message } from 'antd'

const PRODUCTIVITY_OPTIONS = ['100WPH', '150WPH']
const VERSION_OPTIONS = ['3X', '5X']

interface Props {
  systems: string[]
  draft: Record<string, any>
  onSysChange: (sys: string) => void
  onDraftChange: (patch: Record<string, any>) => void
}

const ModelSelectPanel: React.FC<Props> = ({ systems, draft, onSysChange, onDraftChange }) => (
  <div className="model-select-panel">
    <div className="select-row">
      <div className="select-group" style={{ flex: 1, minWidth: 0 }}>
        <label className="select-label">系统选择</label>
        <Select style={{ width: '100%' }}
          value={draft.sys_name || undefined}
          onChange={onSysChange}
          placeholder="请选择系统"
          options={systems.map(s => ({ value: s, label: s }))}
        />
      </div>
      <div className="select-group" style={{ flex: 1, minWidth: 0 }}>
        <label className="select-label">产率</label>
        <Select style={{ width: '100%' }}
          value={draft.model_productivity || undefined}
          onChange={v => onDraftChange({ model_productivity: v })}
          options={PRODUCTIVITY_OPTIONS.map(o => ({ value: o, label: o }))}
        />
      </div>
      <div className="select-group" style={{ flex: 1, minWidth: 0 }}>
        <label className="select-label">版本</label>
        <Select style={{ width: '100%' }}
          value={draft.model_verison || undefined}
          onChange={v => onDraftChange({ model_verison: v })}
          options={VERSION_OPTIONS.map(o => ({ value: o, label: o }))}
        />
      </div>
      <div className="select-group" style={{ flex: 1, minWidth: 0 }}>
        <label className="select-label">仿真时间 (s)</label>
        <Input type="number" placeholder="留空使用默认值"
          value={draft.sim_time ?? ''}
          onChange={e => onDraftChange({ sim_time: e.target.value ? Number(e.target.value) : null })}
          onBlur={e => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v) && v > 0 && v > 19.2) {
              onDraftChange({ sim_time: 19.2 })
              message.error('仿真时间不能超过 19.2s，已自动修正')
            }
          }}
        />
      </div>
    </div>
    {draft.sys_name && (
      <img src={`/api/v1/sim/model_image/${draft.sys_name}`}
        alt={`${draft.sys_name} model`}
        style={{ width: '100%', minHeight: 80, marginTop: 12, borderRadius: 6, border: '1px solid #e8e8e8' }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )}
  </div>
)

export default ModelSelectPanel
