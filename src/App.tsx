import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import type { ComponentType } from 'react'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Home from './pages/Home'
import MechSimLayout from './pages/MechSimLayout'
import Settings from './pages/Settings'
import { getCurrentUser } from './pages/MechSimLayout'
import './App.css'

interface RouteConfig {
  path: string
  label: string
  component: ComponentType<any>
  exact?: boolean
}

// 一份配置同时驱动顶栏 NavLink 和 Route
const routes: RouteConfig[] = [
  { path: '/',        label: '首页',     component: Home },
  { path: '/settings', label: '设置',   component: Settings },
  { path: '/mechsim', label: '仿真平台', component: MechSimLayout },
]

function App() {
  const user = getCurrentUser()

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#3b82f6' } }} locale={zhCN}>
      <div className="parent-shell">
        <header className="top-nav">
          <span className="top-nav-brand">MechSim</span>
          <nav className="top-nav-links">
            {routes.map(r => (
              <NavLink key={r.path} to={r.path} end={r.exact}
                className={({ isActive }) => `top-nav-item${isActive ? ' active' : ''}`}>
                {r.label}
              </NavLink>
            ))}
          </nav>
          <span className="top-nav-user">{user}</span>
        </header>

        <div className="parent-body">
          <Routes>
            {routes.map(r => {
              const Comp = r.component
              return <Route key={r.path} path={r.path} element={<Comp />} />
            })}
            {/* MechSimLayout 的子路由通过 /* 承接 */}
            <Route path="/mechsim/*" element={<MechSimLayout />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </ConfigProvider>
  )
}

export default App
