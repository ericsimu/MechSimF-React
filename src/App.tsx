import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Home from './pages/Home'
import MechSimApp from './pages/MechSimApp'
import CaseList from './pages/CaseList'
import Tasks from './pages/Tasks'
import DataViewer from './pages/DataViewer'
import Placeholder from './pages/Placeholder'
import Settings from './pages/Settings'
import { getCurrentUser } from './pages/MechSimApp'
import './App.css'

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
            <Route path="/settings" element={<Settings />} />
            {/* layout route: MechSimApp 作为壳，内层路由通过 Outlet 渲染 */}
            <Route path="/mechsim" element={<MechSimApp />}>
              <Route index element={<Navigate to="cases" replace />} />
              <Route path="cases" element={<CaseList />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="data/:taskId?" element={<DataViewer />} />
              <Route path="data-manage" element={<Placeholder />} />
              <Route path="tools" element={<Placeholder />} />
              <Route path="manual" element={<Placeholder />} />
              <Route path="indicators" element={<Placeholder />} />
              <Route path="reports" element={<Placeholder />} />
              <Route path="logs" element={<Placeholder />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </ConfigProvider>
  )
}

export default App
