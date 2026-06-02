import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import CaseList from './pages/CaseList'
import Tasks from './pages/Tasks'
import DataViewer from './pages/DataViewer'
import Placeholder from './pages/Placeholder'
import './App.css'

interface NavChild { path: string; label: string }
interface NavItem { path?: string; label: string; children?: NavChild[] }

const navItems: NavItem[] = [
  { path: '/cases', label: '用例编排' },
  { path: '/tasks', label: '任务管理' },
  {
    label: '结果分析',
    children: [
      { path: '/data', label: '数据可视化' },
      { path: '/data', label: '指标查看' },
      { path: '/data', label: '报告查看' },
      { path: '/data', label: '日志查看' },
    ],
  },
  { path: '/data-manage', label: '数据管理' },
  { path: '/tools', label: '工具箱' },
  { path: '/manual', label: '用户手册' },
]

/**
 * 获取当前登录用户名。
 *
 * ## 登录接入指南
 * MechSimF-React 本身不实现登录验证，而是依赖外部系统完成认证后，
 * 将用户名写入 `localStorage` 的 `current_user` 键。
 *
 * 接入步骤：
 * 1. 外部登录系统认证通过后，跳转到本应用时携带用户名参数
 *    或在 iframe/微前端环境中通过 postMessage 传递用户名
 * 2. 本应用通过 `getCurrentUser()` 读取 `localStorage.current_user`
 * 3. 所有 API 请求的 `X-User` 头自动携带该用户名
 * 4. 默认值为 `'user1'`（开发环境）
 *
 * 接口约定（由外部登录系统提供）：
 * - 登录成功后设置 `localStorage.setItem('current_user', username)`
 * - 登出时调用 `localStorage.removeItem('current_user')`
 * - 可选：监听 `storage` 事件实现跨标签页同步
 */
export function getCurrentUser(): string {
  return localStorage.getItem('current_user') || 'user1'
}

export function setCurrentUser(name: string): void {
  localStorage.setItem('current_user', name)
}

function NavGroup({ item }: { item: NavItem }) {
  const loc = useLocation()
  const isChildActive = item.children?.some(c => loc.pathname.startsWith(c.path))
  return (
    <div className="nav-group">
      <div className={`nav-parent ${isChildActive ? 'active' : ''}`}>{item.label}</div>
      <div className="nav-sub">
        {item.children!.map(c => (
          <NavLink key={c.label} to={c.path}
            className={({ isActive }) => `nav-sub-item${isActive ? ' active' : ''}`}>
            {c.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

function App() {
  const user = getCurrentUser()

  return (
    <ConfigProvider
      theme={{ token: { colorPrimary: '#3b82f6' } }}
      locale={zhCN}
    >
      <BrowserRouter>
        <div className="app-shell">
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
              <span className="header-breadcrumb">MechSim 仿真平台</span>
              <span className="header-user">{user}</span>
            </header>
            <main className="app-main">
              <Routes>
                <Route path="/cases" element={<CaseList />} />
                <Route path="/" element={<Navigate to="/cases" replace />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/data/:taskId" element={<DataViewer />} />
                <Route path="/data-manage" element={<Placeholder />} />
                <Route path="/tools" element={<Placeholder />} />
                <Route path="/manual" element={<Placeholder />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
