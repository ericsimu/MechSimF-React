import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Home from './pages/Home'
import MechSimLayout from './pages/MechSimLayout'
import Settings from './pages/Settings'
import { getCurrentUser } from './pages/MechSimLayout'
import './App.css'

const topNavItems = [
  { path: '/',        label: '首页',     exact: true },
  { path: '/mechsim', label: '仿真平台', exact: false },
  { path: '/settings', label: '设置',   exact: true },
]

function App() {
  const user = getCurrentUser()

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#3b82f6' } }} locale={zhCN}>
      <div className="parent-shell">
        <header className="top-nav">
          <span className="top-nav-brand">MechSim</span>
          <nav className="top-nav-links">
            {topNavItems.map(r => (
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
            <Route path="/settings" element={<Settings />} />
            <Route path="/mechsim/*" element={<MechSimLayout />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </ConfigProvider>
  )
}

export default App
