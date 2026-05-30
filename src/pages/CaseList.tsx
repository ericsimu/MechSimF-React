import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Table, Button, Select, Input, Modal, message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  queueCases, addCase, updateCase, queueModelInfo, queueDisturbances,
  getDisturbanceInfo, shareCase, unshareCase, getCaseShares, diffCase, addTasks, runTasks,
  getCurrentUser,
} from '../api/index'
import type {
  CaseModel, ModelInfoMap, DisturbanceDirNode,
  DisturbanceColumn, AddCaseRequest,
} from '../types/api'
import TreeNode from '../components/TreeNode'
import DistTreeNode from '../components/DistTreeNode'
import uPlot from '../lib/uplot/uPlot.esm.js'
import '../lib/uplot/uPlot.min.css'
import './CaseList.css'

// ── Constants ──
const PRODUCTIVITY_OPTIONS = ['100WPH', '150WPH']
const VERSION_OPTIONS = ['3X', '5X']
function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
function isLastLayer(v: unknown): boolean {
  if (!isObject(v)) return false
  return Object.entries(v).filter(([k]) => k !== '_labels').every(([, cv]) => !isObject(cv))
}

type ParamRow = { key: string; label: string; value: string; orig: unknown }
function normalizeTypes(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(normalizeTypes)
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) out[k] = normalizeTypes(v)
    return out
  }
  if (typeof obj === 'string') {
    if (obj === '') return null
    if (obj === 'true' || obj === 'True') return true
    if (obj === 'false' || obj === 'False') return false
    if (obj === 'null' || obj === 'None') return null
    const n = Number(obj)
    if (!Number.isNaN(n) && obj.trim() !== '') return n
  }
  return obj
}

// ── Main Component ──
const CaseList: React.FC = () => {
  // ── Case List State ──
  const [cases, setCases] = useState<CaseModel[]>([])
  const [loading, setLoading] = useState(true)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ── Edit State ──
  const [editCase, setEditCase] = useState<CaseModel | null>(null)
  const [editDraft, setEditDraft] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [modelInfo, setModelInfo] = useState<ModelInfoMap>({})
  const [activeSection, setActiveSection] = useState('')

  // ── Split Pane ──
  const [splitRatio, setSplitRatio] = useState(0.5)
  const [leftWidth, setLeftWidth] = useState(280)
  const [editingCell, setEditingCell] = useState<{ id: number | null; field: string }>({ id: null, field: '' })
  const [editValue, setEditValue] = useState('')

  // ── Delete ──
  const [deleteTarget, setDeleteTarget] = useState<CaseModel | null>(null)

  // ── Share ──
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCaseId, setShareCaseId] = useState<number | null>(null)
  const [shareUsers, setShareUsers] = useState<string[]>([])
  const [shareNewUser, setShareNewUser] = useState('')

  // ── Task / Diff ──
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [diffRows, setDiffRows] = useState<Array<{ path: string; old: string; new: string }>>([])
  const [taskSubmitting, setTaskSubmitting] = useState(false)

  // ── Param Tree ──
  const [paramVars, setParamVars] = useState<Record<string, any>>({})
  const paramVarsRef = useRef(paramVars); paramVarsRef.current = paramVars
  const dirtyValues = useRef<Map<string, string>>(new Map())  // "groupPath|rowKey" → current value
  const [selParamPath, setSelParamPath] = useState('')
  const [paramExpanded, setParamExpanded] = useState<Record<string, boolean>>({})
  const [paramEditGroups, setParamEditGroups] = useState<Array<{
    name: string; path: string; rows: ParamRow[]
  }>>([])

  // ── Disturb Tree ──
  const [disturbTree, setDisturbTree] = useState<DisturbanceDirNode>({})
  const [disturbChecked, setDisturbChecked] = useState<Record<string, boolean>>({})
  const [disturbExpanded, setDisturbExpanded] = useState<Record<string, boolean>>({})
  const [selDisturbFile, setSelDisturbFile] = useState('')
  const [disturbColumns, setDisturbColumns] = useState<DisturbanceColumn[]>([])
  const [disturbVisible, setDisturbVisible] = useState<Record<string, boolean>>({})
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInst = useRef<any>(null)

  const systems = useMemo(() => Object.keys(modelInfo), [modelInfo])
  const paramEntries = useMemo(() => Object.entries(paramVars), [paramVars])
  const disturbEntries = useMemo(() => {
    const dirs = disturbTree?.dirs
    return dirs ? Object.entries(dirs) : []
  }, [disturbTree])

  // ── Load Cases ──
  const loadCases = useCallback(async () => {
    try {
      const r = await queueCases()
      if (r.success && r.data) setCases(r.data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadCases().finally(() => setLoading(false)) }, [loadCases])

  // ── Helpers ──
  function buildCaseBody(src: Record<string, any>): AddCaseRequest {
    return {
      name: src.name || '', description: src.description || '', create_by: src.create_by || getCurrentUser(),
      sys_name: src.sys_name || '', model_name: src.model_name || '',
      model_verison: src.model_verison || '', model_productivity: src.model_productivity || '',
      model_param: src.model_param || '', disturbance: src.disturbance || '',
      sim_time: src.sim_time ?? null, sim_step: src.sim_step ?? null,
    }
  }

  /** 构建包含所有系统参数的 model_param JSON 字符串（与 Vue 版一致）。 */
  function buildFullModelParam(currentVars?: Record<string, any>): string {
    const full: Record<string, any> = {}
    for (const [sys, info] of Object.entries(modelInfo)) {
      if (info.variables) full[sys] = JSON.parse(JSON.stringify(info.variables))
    }
    // Merge saved params from editCase
    if (editCase?.model_param) {
      try {
        const saved = JSON.parse(editCase.model_param)
        for (const [sys, vars] of Object.entries(saved)) { full[sys] = vars }
      } catch { /* */ }
    }
    // Merge currentVars (or paramVars state) for current system
    const name = editDraft.sys_name || editCase?.sys_name
    const vars = currentVars ?? paramVarsRef.current
    if (name && Object.keys(vars).length > 0) {
      full[name] = JSON.parse(JSON.stringify(vars))
    }
    return JSON.stringify(full)
  }

  /** 从 modelInfo 全量或已保存 model_param 中提取当前系统参数子树。 */
  function extractSystemParams(draft: Record<string, any>): Record<string, any> | null {
    const sysName = draft.sys_name
    if (!sysName) return null
    if (draft.model_param) {
      try {
        const parsed = JSON.parse(draft.model_param)
        if (parsed[sysName] && typeof parsed[sysName] === 'object' && !Array.isArray(parsed[sysName]) && Object.keys(parsed[sysName] as object).length > 0) {
          return normalizeTypes(parsed[sysName]) as Record<string, any>
        }
      } catch { /* */ }
    }
    if (modelInfo[sysName]?.variables && Object.keys(modelInfo[sysName].variables!).length > 0) {
      return JSON.parse(JSON.stringify(modelInfo[sysName].variables!))
    }
    return null
  }

  function initParamVars(draft: Record<string, any>) {
    let src: Record<string, any> = {}
    let fromDefaults = false
    const extracted = extractSystemParams(draft)
    if (extracted) {
      src = extracted
    } else if (draft.sys_name && modelInfo[draft.sys_name]?.variables) {
      src = modelInfo[draft.sys_name].variables!
      fromDefaults = true
    }
    setParamVars(src)
    if (fromDefaults) {
      setEditDraft(prev => ({
        ...prev,
        model_param: buildFullModelParam(src),
      }))
    }
  }

  // ── Open Edit ──
  async function openEdit(c: CaseModel) {
    setEditCase(c)
    const draft = { ...c }
    setEditDraft(draft)
    setActiveSection('')
    setParamVars({})
    dirtyValues.current.clear()
    setSelParamPath('')
    setParamExpanded({})
    setParamEditGroups([])
    setDisturbTree({})
    setDisturbChecked({})
    setDisturbExpanded({})
    setSelDisturbFile('')
    setDisturbColumns([])
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null }

    try {
      const r = await queueModelInfo()
      if (r.success && r.data) {
        setModelInfo(r.data)
        initParamVarsFilter(draft, r.data)
        return
      }
    } catch { /* */ }
    initParamVars(draft)
  }

  function initParamVarsFilter(draft: Record<string, any>, mi: ModelInfoMap) {
    let src: Record<string, any> = {}
    let fromDefaults = false
    const extracted = extractSystemParams(draft)
    if (extracted) {
      src = extracted
    } else if (draft.sys_name && mi[draft.sys_name]?.variables) {
      src = mi[draft.sys_name].variables!
      fromDefaults = true
    }
    setParamVars(src)
    if (fromDefaults) {
      setEditDraft(prev => ({
        ...prev,
        model_param: buildFullModelParam(src),
      }))
    }
  }

  // ── Save ──
  async function handleSave(silent = false) {
    if (!editCase) return
    // Flush pending param edits before building body
    for (const g of paramEditGroups) saveParamGroup(g)
    setSaving(true)
    try {
      const body = buildCaseBody({ ...editCase, ...editDraft, model_param: buildFullModelParam() })
      const r = await updateCase(editCase.id!, body)
      if (r.success) {
        // Sync update editCase for immediate reads after handleSave (matching Vue Object.assign)
        Object.assign(editCase, editDraft)
        setCases(prev => prev.map(c => c.id === editCase.id ? { ...editCase } : c))
        if (!silent) message.success('保存成功')
      } else {
        message.error(r.message || '保存失败')
      }
    } catch { message.error('保存失败') }
    finally { setSaving(false) }
  }

  // ── Inline Edit ──
  function startInline(c: CaseModel, field: string) {
    setEditingCell({ id: c.id!, field })
    setEditValue((c as any)[field] || '')
  }
  function cancelInline() { setEditingCell({ id: null, field: '' }) }

  async function saveInline(c: CaseModel, field: string) {
    const val = editValue
    cancelInline()
    if (val === ((c as any)[field] || '')) return
    const body = buildCaseBody(c)
    ;(body as any)[field] = val
    const r = await updateCase(c.id!, body)
    if (r.success) {
      (c as any)[field] = val
      setEditDraft(prev => ({ ...prev, [field]: val }))
      setCases(prev => [...prev])
    }
  }

  // ── Add Case ──
  async function handleAdd() {
    if (!addName.trim()) return
    setSubmitting(true)
    try {
      const r = await addCase({
        name: addName.trim(), description: addDesc.trim(), create_by: getCurrentUser(),
        sys_name: '', model_name: '', model_verison: '3X', model_productivity: '100WPH', model_param: '', disturbance: '',
      })
      if (r.success) {
        const newId = r.data!.id
        setAddName(''); setAddDesc(''); setAddModalOpen(false)
        const fresh = await queueCases()
        if (fresh.success && fresh.data) {
          setCases(fresh.data)
          const found = fresh.data.find(c => c.id === newId)
          if (found) openEdit(found)
        }
      }
    } catch { message.error('添加失败') }
    finally { setSubmitting(false) }
  }

  // ── Copy ──
  async function handleCopy(c: CaseModel) {
    try {
      const r = await addCase({ ...buildCaseBody(c), name: c.name + '_copy', create_by: getCurrentUser() })
      if (r.success) await loadCases()
    } catch { message.error('复制失败') }
  }

  // ── Delete ──
  const [deleting, setDeleting] = useState(false)

  function confirmDelete(c: CaseModel) { setDeleteTarget(c) }
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const body: any = { ...buildCaseBody(deleteTarget), is_deleted: true }
      const r = await updateCase(deleteTarget.id!, body)
      if (r.success) {
        setDeleteTarget(null)
        if (editCase?.id === deleteTarget.id) setEditCase(null)
        await loadCases()
        message.success('删除成功')
      }
    } catch { message.error('删除失败') }
    finally { setDeleting(false) }
  }

  // ── Share ──
  async function openShare(c: CaseModel) {
    setShareCaseId(c.id!)
    setShareOpen(true)
    try {
      const r = await getCaseShares(c.id!)
      if (r.success && r.data) setShareUsers(r.data.map((s: any) => s.shared_to_user))
    } catch { /* */ }
  }
  async function handleShare() {
    if (!shareNewUser.trim() || !shareCaseId) return
    const r = await shareCase(shareCaseId, shareNewUser.trim())
    if (r.success) {
      setShareUsers(prev => [...prev, shareNewUser.trim()])
      setShareNewUser('')
    }
  }
  async function handleUnshare(user: string) {
    if (!shareCaseId) return
    const r = await unshareCase(shareCaseId, user)
    if (r.success) setShareUsers(prev => prev.filter(u => u !== user))
  }

  // ── Left Panel Section Activation ──
  async function activateSection(key: string) {
    setActiveSection(key)
    if (key === 'model' && Object.keys(modelInfo).length === 0) {
      try {
        const r = await queueModelInfo()
        if (r.success && r.data) setModelInfo(r.data)
      } catch { /* */ }
    }
    if (!editDraft.model_productivity) setEditDraft(prev => ({ ...prev, model_productivity: PRODUCTIVITY_OPTIONS[0] }))
    if (!editDraft.model_verison) setEditDraft(prev => ({ ...prev, model_verison: VERSION_OPTIONS[0] }))
  }

  async function toggleTree(key: string) {
    if (activeSection === key) { setActiveSection(''); return }
    setActiveSection(key)

    if (key === 'model') {
      if (Object.keys(modelInfo).length === 0) {
        try { const r = await queueModelInfo(); if (r.success && r.data) setModelInfo(r.data) } catch { /* */ }
      }
      if (!editDraft.model_productivity) setEditDraft(prev => ({ ...prev, model_productivity: PRODUCTIVITY_OPTIONS[0] }))
      if (!editDraft.model_verison) setEditDraft(prev => ({ ...prev, model_verison: VERSION_OPTIONS[0] }))
    }

    if (key === 'param') {
      // Auto-expand all param tree nodes
      function expandAllParams(node: Record<string, any>, path = ''): Record<string, boolean> {
        const keys: Record<string, boolean> = {}
        if (isObject(node)) {
          for (const [k, v] of Object.entries(node)) {
            if (k === '_labels') continue
            const p = path ? `${path}.${k}` : k
            keys[p] = true
            if (isObject(v) && !isLastLayer(v)) Object.assign(keys, expandAllParams(v, p))
          }
        }
        return keys
      }
      // Use setTimeout to ensure paramVars is populated from latest state
      setTimeout(() => setParamExpanded(expandAllParams(paramVars)), 0)
    }

    if (key === 'disturb') {
      if (Object.keys(disturbTree).length === 0) {
        try {
          const r = await queueDisturbances()
          if (r.success && r.data) {
            setDisturbTree(r.data)
            function expandAll(node: DisturbanceDirNode, path = ''): Record<string, boolean> {
              const keys: Record<string, boolean> = {}
              const dirs = node.dirs || {}
              Object.entries(dirs).forEach(([k, v]) => {
                const p = path ? `${path}/${k}` : k
                keys[p] = true
                Object.assign(keys, expandAll(v, p))
              })
              return keys
            }
            setDisturbExpanded(expandAll(r.data))
          }
        } catch { /* */ }
      }
      if (editDraft.disturbance) {
        try {
          const d = JSON.parse(editDraft.disturbance)
          if (d?.length > 0) {
            const ck: Record<string, boolean> = {}
            d.forEach((x: any) => { if (x.checked) ck[x.path] = true })
            setDisturbChecked(ck)
          }
        } catch { /* */ }
      }
    }
  }

  // ── Param Tree Interactions ──
  function onSystemChange(sys: string) {
    const fullModelParam = buildFullModelParam()
    setEditDraft(prev => ({ ...prev, sys_name: sys, model_name: sys, model_param: fullModelParam }))
    // 从全量 model_param 或 modelInfo 加载新系统参数
    let src: Record<string, any> | null = null
    try {
      const full = JSON.parse(fullModelParam)
      if (full[sys] && typeof full[sys] === 'object' && !Array.isArray(full[sys]) && Object.keys(full[sys] as object).length > 0) {
        src = normalizeTypes(full[sys]) as Record<string, any>
      }
    } catch { /* */ }
    if (!src && modelInfo[sys]?.variables && Object.keys(modelInfo[sys].variables!).length > 0) {
      src = JSON.parse(JSON.stringify(modelInfo[sys].variables!))
    }
    if (src) setParamVars(src)
  }

  function onParamSelect(path: string) {
    setSelParamPath(path)
    setActiveSection('param')
    const parts = path.split('.')
    let node: any = paramVarsRef.current
    for (const p of parts) { if (!isObject(node)) { node = undefined; break } node = node[p] }
    if (!isObject(node)) { setParamEditGroups([]); return }
    const labelMap: Record<string, string> = (node as any)._labels || {}
    const entries = Object.entries(node).filter(([k]) => k !== '_labels')
    const hasNested = entries.some(([, v]) => isObject(v))

    function fmt(v: unknown): string {
      if (v === null || v === undefined) return ''
      if (Array.isArray(v)) return JSON.stringify(v)
      return String(v)
    }

    function mkRow(k: string, v: unknown, labels: Record<string, string>): ParamRow {
      return { key: k, label: labels[k] || '', value: fmt(v), orig: v }
    }

    if (!hasNested) {
      setParamEditGroups([{
        name: parts[parts.length - 1], path,
        rows: entries.map(([k, v]) => mkRow(k, v, labelMap)),
      }])
      return
    }
    if (entries.every(([, v]) => isLastLayer(v))) {
      setParamEditGroups(entries.map(([cn, cv]) => ({
        name: cn, path: `${path}.${cn}`,
        rows: Object.entries(cv as Record<string, unknown>).filter(([k]) => k !== '_labels').map(([k, v]) => mkRow(k, v, (cv as any)._labels || {})),
      })))
      return
    }
    setParamEditGroups([])
  }

  function coerceByType(val: string, orig: unknown) {
    if (val === '' && (orig === null || orig === undefined)) return null
    const t = typeof orig
    if (t === 'number') return Number.isInteger(orig as number) ? parseInt(val, 10) : parseFloat(val)
    if (t === 'boolean') return val === 'true' || val === '1'
    return val
  }

  function saveParamGroup(group: { name: string; path: string; rows: ParamRow[] }) {
    const parts = group.path.split('.')
    const nv = JSON.parse(JSON.stringify(paramVarsRef.current))
    let node = nv
    for (const p of parts) node = node[p]
    group.rows.forEach(r => {
      const dk = `${group.path}|${r.key}`
      const val = dirtyValues.current.has(dk) ? dirtyValues.current.get(dk)! : r.value
      node[r.key] = coerceByType(val, r.orig)
    })
    paramVarsRef.current = nv  // Sync ref so buildFullModelParam sees latest value
    setParamVars(nv)
    setEditDraft(prev => ({ ...prev, model_param: buildFullModelParam(nv) }))
  }

  // ── Disturb Interactions ──
  function onDisturbCheck(fullPath: string) {
    setDisturbChecked(prev => {
      const next = { ...prev }
      if (next[fullPath]) delete next[fullPath]
      else next[fullPath] = true
      const dist = Object.entries(next).filter(([, v]) => v).map(([k]) => ({
        path: k, name: k.split(/[/\\]/).pop(), checked: true,
      }))
      setEditDraft(prev => ({ ...prev, disturbance: JSON.stringify(dist) }))
      return next
    })
  }

  async function onDisturbLeafClick(filePath: string) {
    setSelDisturbFile(filePath)
    setActiveSection('disturb')
    setDisturbColumns([])
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null }
    try {
      const r = await getDisturbanceInfo(filePath)
      if (r.success && r.data?.columns) {
        setDisturbColumns(r.data.columns)
        const vis: Record<string, boolean> = {}
        r.data.columns.forEach(c => { vis[c.name] = true })
        setDisturbVisible(prev => ({ ...prev, ...vis }))
      }
    } catch { /* */ }
  }

  // ── Chart ──
  useEffect(() => {
    if (!chartRef.current || disturbColumns.length === 0) {
      if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null }
      return
    }
    const active = disturbColumns.filter(c => disturbVisible[c.name] !== false)
    const nonEmpty = active.filter(c => c.data && c.data.some(v => v != null))
    if (nonEmpty.length === 0) {
      if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null }
      return
    }
    const xData = nonEmpty[0].data.map((_, i) => i)
    const series: Array<object> = [{}]
    nonEmpty.forEach((c, i) => series.push({ label: c.name, stroke: `hsl(${(i * 60) % 360},70%,50%)`, width: 1.5 }))
    const data = [xData, ...nonEmpty.map(c => c.data.map(v => v == null ? null : Number(v)) || [])]
    if (chartInst.current) chartInst.current.destroy()
    try {
      chartInst.current = new (uPlot as any)({
        width: chartRef.current.offsetWidth, height: 400,
        cursor: { show: true }, legend: { show: false },
        scales: { x: { time: false } },
        axes: [{}, { stroke: '#888', grid: { stroke: '#e8e8e8' } }],
        series,
      }, data, chartRef.current)
    } catch { /* */ }
  }, [disturbColumns, disturbVisible])

  // ── Task ──
  async function openTaskModal() {
    await handleSave(true)
    if (!editCase) return
    const body = buildCaseBody({ ...editCase, ...editDraft, model_param: buildFullModelParam() })
    try {
      const r = await diffCase(editCase.id!, body)
      if (r.success && r.data) {
        const diffDict = r.data as unknown as Record<string, Record<string, { old_value?: unknown; new_value?: unknown }>>
        function cleanPath(raw: string): string {
          return raw.replace(/^root/, '').replace(/\['([^']*)'\]/g, '.$1').replace(/\["([^"]*)"\]/g, '.$1').replace(/^\./, '')
        }
        const rows: Array<{ path: string; old: string; new: string }> = []
        const fmt = (v: unknown): string =>
          v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
        for (const [changeType, items] of Object.entries(diffDict)) {
          if (!items || typeof items !== 'object') continue
          const prefix = changeType.includes('added') ? '+ ' : changeType.includes('removed') ? '- ' : ''
          for (const [path, v] of Object.entries(items)) {
            rows.push({ path: prefix + cleanPath(path), old: fmt(v.old_value), new: fmt(v.new_value) })
          }
        }
        setDiffRows(rows)
      }
    } catch { message.error('获取差异失败') }
    setTaskModalOpen(true)
  }

  async function handleRunTask() {
    setTaskSubmitting(true)
    try {
      await handleSave(true)
      if (!editCase) return
      const r = await addTasks(editCase.id!)
      if (!r.success) return
      const taskIds = r.data!.task_ids
      const runR = await runTasks(taskIds)
      if (runR.success) {
        message.success(`任务已提交 (ID: ${taskIds.join(',')})`)
        setTaskModalOpen(false)
      }
    } catch { message.error('任务提交失败') }
    finally { setTaskSubmitting(false) }
  }

  // ── Resize Handlers ──
  function startResize(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    const container = target.parentElement!
    const containerTop = container.getBoundingClientRect().top
    const containerH = container.offsetHeight
    document.body.style.userSelect = 'none'
    function onMove(ev: MouseEvent) {
      setSplitRatio(Math.min(0.8, Math.max(0.2, (ev.clientY - containerTop) / containerH)))
    }
    function onUp() {
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function startResizeLeft(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    const editBody = target.parentElement!
    const bodyLeft = editBody.getBoundingClientRect().left
    const bodyW = editBody.offsetWidth
    document.body.style.userSelect = 'none'
    function onMove(ev: MouseEvent) {
      setLeftWidth(Math.min(bodyW * 0.6, Math.max(180, ev.clientX - bodyLeft)))
    }
    function onUp() {
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ── Table Columns ──
  const columns: TableColumnsType<CaseModel> = [
    {
      title: '名称', dataIndex: 'name', key: 'name',
      render: (text: string, record: CaseModel) =>
        editingCell.id === record.id && editingCell.field === 'name' ? (
          <Input size="small" value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => saveInline(record, 'name')}
            onPressEnter={() => saveInline(record, 'name')}
            onKeyDown={e => e.key === 'Escape' && cancelInline()}
            autoFocus
          />
        ) : <span className="editable-cell" onClick={() => startInline(record, 'name')}>{text || '-'}</span>,
    },
    {
      title: '描述', dataIndex: 'description', key: 'description',
      render: (text: string, record: CaseModel) =>
        editingCell.id === record.id && editingCell.field === 'description' ? (
          <Input size="small" value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => saveInline(record, 'description')}
            onPressEnter={() => saveInline(record, 'description')}
            onKeyDown={e => e.key === 'Escape' && cancelInline()}
            autoFocus
          />
        ) : <span className="editable-cell" onClick={() => startInline(record, 'description')}>{text || '-'}</span>,
    },
    { title: '创建者', dataIndex: 'create_by', key: 'create_by' },
    {
      title: '创建时间', dataIndex: 'create_time', key: 'create_time',
      render: (t: string) => t ? new Date(t).toLocaleString() : '-',
    },
    {
      title: '操作', key: 'actions',
      render: (_: unknown, record: CaseModel) => (
        <div className="actions-cell">
          <Button type="text" size="small" className="action-btn" onClick={() => openEdit(record)}>编辑</Button>
          <Button type="text" size="small" className="action-btn" onClick={() => handleCopy(record)}>复制</Button>
          <Button type="text" size="small" className="action-btn" onClick={() => openShare(record)}>共享</Button>
          <Button type="text" size="small" className="action-btn" onClick={() => confirmDelete(record)}>删除</Button>
        </div>
      ),
    },
  ]

  // ── Render ──
  return (
    <div className="case-page">
      <div className="split-container">
        {/* Case Table */}
        <div className="case-list" style={editCase ? { height: `${splitRatio * 100}%`, overflow: 'auto' } : {}}>
          <div className="page-header">
            <h2>用例列表</h2>
            <Button className="btn-outline" onClick={() => setAddModalOpen(true)}>创建用例</Button>
          </div>
          <Table
            columns={columns}
            dataSource={cases}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={false}
            locale={{ emptyText: '暂无数据' }}
            rowClassName={(r) => editCase?.id === r.id ? 'row-selected' : ''}
          />
        </div>

        {editCase && (
          <>
            <div className="resize-handle" onMouseDown={startResize} />

            <div className="edit-panel">
              <div className="edit-toolbar">
                <h3>{editCase.name}</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button className="btn-outline" size="small" onClick={openTaskModal}>创建任务</Button>
                  <Button className="btn-outline" size="small" loading={saving} onClick={() => handleSave()}>保存</Button>
                </div>
              </div>

              <div className="edit-body">
                <div className="edit-left" style={{ width: leftWidth }}>
                  <div className={`tree-section ${activeSection === 'model' ? 'section-active' : ''}`}
                    onClick={() => activateSection('model')}>
                    <div className="tree-section-header"><span>模型选择</span></div>
                  </div>
                  <div className={`tree-section ${activeSection === 'param' ? 'section-active' : ''}`}
                    onClick={() => toggleTree('param')}>
                    <div className="tree-section-header">
                      <span className="tree-section-arrow">{activeSection === 'param' ? '▼' : '▶'}</span>
                      <span>参数配置</span>
                    </div>
                    {activeSection === 'param' && (
                      <div className="tree-content">
                        {paramEntries.map(([k, v]) => (
                          <TreeNode key={k} name={k} value={v} path={k}
                            selPath={selParamPath} expanded={paramExpanded}
                            onToggle={p => setParamExpanded(prev => ({ ...prev, [p]: !prev[p] }))}
                            onSelect={onParamSelect}
                          />
                        ))}
                        {paramEntries.length === 0 && <div className="tree-empty">暂无参数数据</div>}
                      </div>
                    )}
                  </div>
                  <div className={`tree-section ${activeSection === 'disturb' ? 'section-active' : ''}`}
                    onClick={() => toggleTree('disturb')}>
                    <div className="tree-section-header">
                      <span className="tree-section-arrow">{activeSection === 'disturb' ? '▼' : '▶'}</span>
                      <span>扰动分析</span>
                    </div>
                    {activeSection === 'disturb' && (
                      <div className="tree-content">
                        {disturbEntries.map(([k, v]) => (
                          <DistTreeNode key={k} name={k} value={v} path={k}
                            checked={disturbChecked} expanded={disturbExpanded} selFile={selDisturbFile}
                            onToggle={p => setDisturbExpanded(prev => ({ ...prev, [p]: !prev[p] }))}
                            onCheck={onDisturbCheck} onLeafClick={onDisturbLeafClick}
                          />
                        ))}
                        {disturbTree.files?.length! > 0 && (
                          <>
                            {disturbTree.files!.map(f => (
                              <div className="tree-node" key={f.path}>
                                <label onClick={e => e.stopPropagation()}>
                                  <span className="tree-toggle" style={{ visibility: 'hidden' }}>{'▶'}</span>
                                  <input type="checkbox" checked={!!disturbChecked[f.path]}
                                    onChange={() => onDisturbCheck(f.path)} />
                                  <span style={{ cursor: 'pointer', color: selDisturbFile === f.path ? '#3b82f6' : undefined }}
                                    onClick={() => onDisturbLeafClick(f.path)}>{f.name}</span>
                                </label>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={`tree-section ${activeSection === 'indicator' ? 'section-active' : ''}`}
                    onClick={() => setActiveSection(activeSection === 'indicator' ? '' : 'indicator')}>
                    <div className="tree-section-header">
                      <span className="tree-section-arrow">{activeSection === 'indicator' ? '▼' : '▶'}</span>
                      <span>指标分析</span>
                    </div>
                    {activeSection === 'indicator' && (
                      <div className="tree-content">
                        <div className="tree-empty">此页面暂未填充内容</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-resize-handle" onMouseDown={startResizeLeft} />

                <div className="edit-right">
                  {activeSection === 'model' && (
                    <div className="model-select-panel">
                      <div className="select-group">
                        <label className="select-label">系统选择</label>
                        <Select
                          style={{ width: '100%' }}
                          value={editDraft.sys_name || undefined}
                          onChange={(v) => onSystemChange(v)}
                          placeholder="请选择系统"
                          options={systems.map(s => ({ value: s, label: s }))}
                        />
                      </div>
                      <div className="select-group">
                        <label className="select-label">产率</label>
                        <Select
                          style={{ width: '100%' }}
                          value={editDraft.model_productivity || undefined}
                          onChange={(v) => setEditDraft(prev => ({ ...prev, model_productivity: v }))}
                          options={PRODUCTIVITY_OPTIONS.map(o => ({ value: o, label: o }))}
                        />
                      </div>
                      <div className="select-group">
                        <label className="select-label">版本</label>
                        <Select
                          style={{ width: '100%' }}
                          value={editDraft.model_verison || undefined}
                          onChange={(v) => setEditDraft(prev => ({ ...prev, model_verison: v }))}
                          options={VERSION_OPTIONS.map(o => ({ value: o, label: o }))}
                        />
                      </div>
                      <div className="select-group">
                        <label className="select-label">仿真时间 (s)</label>
                        <Input type="number" placeholder="留空使用默认值"
                          value={editDraft.sim_time ?? ''}
                          onChange={e => setEditDraft(prev => ({ ...prev, sim_time: e.target.value ? Number(e.target.value) : null }))}
                        />
                      </div>
                      <div className="select-group">
                        <label className="select-label">仿真步长 (s)</label>
                        <Input type="number" placeholder="留空使用默认值"
                          value={editDraft.sim_step ?? ''}
                          onChange={e => setEditDraft(prev => ({ ...prev, sim_step: e.target.value ? Number(e.target.value) : null }))}
                        />
                      </div>
                    </div>
                  )}

                  {activeSection === 'param' && paramEditGroups.length > 0 && (
                    <>
                      {paramEditGroups.map(g => (
                        <div className="param-group" key={g.path}>
                          <div className="param-group-title">{g.name}</div>
                          <Table
                            size="small"
                            showHeader={false}
                            pagination={false}
                            dataSource={g.rows.map((r, i) => ({ ...r, _key: i }))}
                            rowKey="_key"
                            columns={[
                              {
                                title: '参数名', dataIndex: 'key', width: 200,
                                render: (k: string, r: any) => (
                                  <span>{k}{r.label ? <span style={{ color: '#888', marginLeft: 4 }}>({r.label})</span> : null}</span>
                                ),
                              },
                              {
                                title: '参数值', dataIndex: 'value',
                                render: (_v: string, r: any) => {
                                  const dk = `${g.path}|${r.key}`
                                  const val = dirtyValues.current.has(dk) ? dirtyValues.current.get(dk)! : String(r.orig ?? '')
                                  return (
                                    <input
                                      className="ant-input css-var-R1a ant-input-sm"
                                      style={{ width: '100%' }}
                                      value={val}
                                      onChange={e => {
                                        dirtyValues.current.set(dk, e.target.value)
                                        // Force re-render by updating a counter
                                        setParamVars(prev => ({ ...prev }))
                                      }}
                                      onBlur={() => saveParamGroup(g)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                      }}
                                    />
                                  )
                                },
                              },
                            ]}
                          />
                        </div>
                      ))}
                    </>
                  )}

                  {activeSection === 'disturb' && disturbColumns.length > 0 && (
                    <>
                      <div ref={chartRef} className="chart-container" />
                      <div className="chart-legend">
                        {disturbColumns.map((c, i) => (
                          <label key={c.name} className="chart-legend-item">
                            <input type="checkbox" checked={disturbVisible[c.name] !== false}
                              onChange={() => setDisturbVisible(prev => ({ ...prev, [c.name]: !prev[c.name] }))} />
                            <span className="legend-dot" style={{ backgroundColor: `hsl(${(i * 60) % 360},70%,50%)` }} />
                            {c.name}
                          </label>
                        ))}
                      </div>
                    </>
                  )}

                  {!activeSection && (
                    <div className="edit-right-empty">选择左侧节点查看详情</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Modal */}
      <Modal title="创建用例" open={addModalOpen} onCancel={() => setAddModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setAddModalOpen(false)}>取消</Button>,
          <Button key="confirm" type="primary" loading={submitting} onClick={handleAdd}>添加</Button>,
        ]}
      >
        <div className="form-group">
          <label className="form-label">用例名称</label>
          <Input value={addName} onChange={e => setAddName(e.target.value)} placeholder="输入用例名称" />
        </div>
        <div className="form-group">
          <label className="form-label">用例描述</label>
          <Input.TextArea value={addDesc} onChange={e => setAddDesc(e.target.value)} rows={3}
            placeholder="输入用例描述" spellCheck={false} autoCorrect="off" autoCapitalize="off" />
        </div>
      </Modal>

      {/* Share Modal */}
      <Modal title="共享用例" open={shareOpen} onCancel={() => setShareOpen(false)}
        footer={null}
      >
        <div className="share-subtitle">已共享用户</div>
        {shareUsers.length > 0 ? (
          <div className="share-list">
            {shareUsers.map(u => (
              <div className="share-user-row" key={u}>
                <span>{u}</span>
                <Button size="small" danger onClick={() => handleUnshare(u)}>移除</Button>
              </div>
            ))}
          </div>
        ) : <div className="share-empty">暂无共享用户</div>}
        <div className="share-add-row">
          <Input value={shareNewUser} onChange={e => setShareNewUser(e.target.value)} placeholder="输入用户名" style={{ flex: 1 }} />
          <Button type="primary" onClick={handleShare}>添加</Button>
        </div>
      </Modal>

      {/* Task Modal */}
      <Modal title="创建仿真任务" open={taskModalOpen} onCancel={() => setTaskModalOpen(false)}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setTaskModalOpen(false)}>取消</Button>,
          <Button key="run" type="primary" loading={taskSubmitting} onClick={handleRunTask}>运行</Button>,
        ]}
      >
        <div className="diff-section-title">参数变更预览</div>
        {diffRows.length > 0 ? (
          <Table
            size="small"
            pagination={false}
            dataSource={diffRows.map((r, i) => ({ ...r, _key: i }))}
            rowKey="_key"
            columns={[
              { title: '参数路径', dataIndex: 'path', className: 'diff-path' },
              { title: '原值', dataIndex: 'old', className: 'diff-old' },
              { title: '新值', dataIndex: 'new', className: 'diff-new' },
            ]}
          />
        ) : <div className="diff-empty">无变更</div>}
      </Modal>

      {/* Delete Confirm */}
      <Modal title="确认删除" open={!!deleteTarget} onCancel={() => setDeleteTarget(null)}
        footer={[
          <Button key="cancel" onClick={() => setDeleteTarget(null)}>取消</Button>,
          <Button key="confirm" danger type="primary" loading={deleting} onClick={handleDelete}>确认</Button>,
        ]}
      >
        <p>确定要删除用例 <b>{deleteTarget?.name}</b> 吗？</p>
        <p className="delete-hint">此操作不可撤销</p>
      </Modal>
    </div>
  )
}

export default CaseList
