import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Home from './pages/Home'
import MechSimApp from './pages/MechSimApp'
import Settings from './pages/Settings'
import { getCurrentUser } from './pages/MechSimApp'
import './App.css'

/**
 * 父级导航配置。
 * 新增页面在这里加一项即可，path 和 label 会同时用于 NavLink 和 Route。
 */
const parentRoutes = [
  { path: '/',       label: '首页',     exact: true },
  { path: '/mechsim', label: '仿真平台', exact: false },
  { path: '/settings', label: '设置',   exact: true },
]

function App() {
  const user = getCurrentUser()

  return (
    <ConfigProvider
      theme={{ token: { colorPrimary: '#3b82f6' } }}
      locale={zhCN}
    >
      <div className="parent-shell">
        <header className="top-nav">
          <span className="top-nav-brand">MechSim</span>
          <nav className="top-nav-links">
            {parentRoutes.map(r => (
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
            <Route path="/" element={<Home />} />
            <Route path="/mechsim" element={<Navigate to="/mechsim/cases" replace />} />
            <Route path="/mechsim/*" element={<MechSimApp />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </ConfigProvider>
  )
}

export default App
