import React from 'react'

type ParamRow = { key: string; label: string; unit: string; value: string; orig: unknown }

interface Group {
  name: string
  path: string
  rows: ParamRow[]
}

interface Props {
  groups: Group[]
  dirtyValues: React.MutableRefObject<Map<string, string>>
  onSave: (g: Group) => void
  forceUpdate: () => void
}

const ParamEditor: React.FC<Props> = ({ groups, dirtyValues, onSave, forceUpdate }) => (
  <>
    {groups.map(g => (
      <div className="param-group" key={g.path}>
        <div className="param-group-title">{g.name}</div>
        <table className="param-table">
          <thead><tr><th>参数名</th><th>参数值</th><th>单位</th></tr></thead>
          <tbody>
            {g.rows.map(r => {
              const dk = `${g.path}|${r.key}`
              const val = dirtyValues.current.has(dk) ? dirtyValues.current.get(dk)! : String(r.orig ?? '')
              return (
                <tr key={r.key}>
                  <td>{r.key}{r.label ? <span style={{ color: '#888', marginLeft: 4 }}>({r.label})</span> : null}</td>
                  <td>
                    <input className="param-input"
                      value={val}
                      onChange={e => {
                        dirtyValues.current.set(dk, e.target.value)
                        forceUpdate()
                      }}
                      onBlur={() => onSave(g)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    />
                  </td>
                  <td style={{ color: '#888', fontSize: 12 }}>{r.unit || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    ))}
  </>
)

export default ParamEditor
