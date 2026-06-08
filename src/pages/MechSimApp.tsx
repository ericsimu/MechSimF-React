import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom'
import CaseList from './CaseList'
import Tasks from './Tasks'
import DataViewer from './DataViewer'
import Placeholder from './Placeholder'

// 嵌套路由下，NavLink 和 Route 需带完整路径才能正确解析
const BASE = '/mechsim'

interface NavChild { path?: string; label: string }
interface NavItem { path?: string; label: string; children?: NavChild[] }

const navItems: NavItem[] = [
  { path: `${BASE}/cases`, label: '用例编排' },
  { path: `${BASE}/tasks`, label: '任务管理' },
  {
    label: '结果分析',
    children: [
      { path: `${BASE}/data`, label: '数据可视化' },
      { path: `${BASE}/indicators`, label: '指标查看' },
      { path: `${BASE}/reports`, label: '报告查看' },
      { path: `${BASE}/logs`, label: '日志查看' },
    ],
  },
  { path: `${BASE}/data-manage`, label: '数据管理' },
  { path: `${BASE}/tools`, label: '工具箱' },
  { path: `${BASE}/manual`, label: '用户手册' },
]

export function getCurrentUser(): string {
  return localStorage.getItem('current_user') || 'user1'
}

export function setCurrentUser(name: string): void {
  localStorage.setItem('current_user', name)
}

function NavGroup({ item }: { item: NavItem }) {
  const loc = useLocation()
  const isChildActive = item.children?.some(c =>
    c.path && loc.pathname.startsWith(c.path)
  )
  return (
    <div className="nav-group">
      <div className={`nav-parent ${isChildActive ? 'active' : ''}`}>{item.label}</div>
      <div className="nav-sub">
        {item.children!.map(c =>
          c.path ? (
            <NavLink key={c.label} to={c.path}
              className={({ isActive }) => `nav-sub-item${isActive ? ' active' : ''}`}>
              {c.label}
            </NavLink>
          ) : (
            <span key={c.label} className="nav-sub-item" style={{ opacity: 0.5 }}>{c.label}</span>
          )
        )}
      </div>
    </div>
  )
}

function MechSimApp() {
  const user = getCurrentUser()

  return (
    <div className="app-shell mechsim-app">
      <aside className="sidebar">
        <div className="sidebar-brand">MechSim</div>
        <nav className="sidebar-nav">
          {navItems.map((item, i) =>
            item.path ? (
              <NavLink key={item.path} to={item.path} end
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                {item.label}
              </NavLink>
            ) : (
              <NavGroup key={i} item={item} />
            )
          )}
        </nav>
        <div className="sidebar-user" title="当前登录用户">{user}</div>
      </aside>
      <div className="app-body">
        <header className="app-header">
          <span className="header-breadcrumb">MechSim (机电仿真平台)</span>
          <span className="header-user">{user}</span>
        </header>
        <main className="app-main">
          <Routes>
            <Route path={`${BASE}/cases`} element={<CaseList />} />
            <Route path={`${BASE}`} element={<Navigate to={`${BASE}/cases`} replace />} />
            <Route path={`${BASE}/tasks`} element={<Tasks />} />
            <Route path={`${BASE}/data/:taskId?`} element={<DataViewer />} />
            <Route path={`${BASE}/data-manage`} element={<Placeholder />} />
            <Route path={`${BASE}/tools`} element={<Placeholder />} />
            <Route path={`${BASE}/manual`} element={<Placeholder />} />
            <Route path={`${BASE}/indicators`} element={<Placeholder />} />
            <Route path={`${BASE}/reports`} element={<Placeholder />} />
            <Route path={`${BASE}/logs`} element={<Placeholder />} />
            <Route path="*" element={<Navigate to={`${BASE}/cases`} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default MechSimApp
