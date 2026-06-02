import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import CaseList from './pages/CaseList'
import Tasks from './pages/Tasks'
import DataViewer from './pages/DataViewer'
import './App.css'

const navItems = [
  { path: '/', label: '用例编排' },
  { path: '/tasks', label: '任务列表' },
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

function App() {
  const user = getCurrentUser()

  return (
    <ConfigProvider
      theme={{ token: { colorPrimary: '#3b82f6' } }}
      locale={zhCN}
    >
      <BrowserRouter>
        <div className="app-shell">
          <div className="app-body">
            <header className="app-header">
              <span className="header-breadcrumb">MechSim 仿真平台</span>
              <nav className="header-nav">
                {navItems.map(item => (
                  <NavLink key={item.path} to={item.path} end
                    className={({ isActive }) => `header-nav-item${isActive ? ' active' : ''}`}>
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <span className="header-user">{user}</span>
            </header>
            <main className="app-main">
              <Routes>
                <Route path="/" element={<CaseList />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/data/:taskId" element={<DataViewer />} />
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
