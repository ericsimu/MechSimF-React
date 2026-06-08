import { Switch, Route, Redirect, NavLink, useLocation, matchPath } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import CaseList from './pages/CaseList'
import Tasks from './pages/Tasks'
import DataViewer from './pages/DataViewer'
import Placeholder from './pages/Placeholder'
import './App.css'

interface NavChild { path?: string; label: string }
interface NavItem { path?: string; label: string; children?: NavChild[] }

// 绝对路径，嵌入时由 BrowserRouter basename 处理前缀
const navItems: NavItem[] = [
  { path: '/cases', label: '用例编排' },
  { path: '/tasks', label: '任务管理' },
  {
    label: '结果分析',
    children: [
      { path: '/data', label: '数据可视化' },
      { path: '/indicators', label: '指标查看' },
      { path: '/reports', label: '报告查看' },
      { path: '/logs', label: '日志查看' },
    ],
  },
  { path: '/data-manage', label: '数据管理' },
  { path: '/tools', label: '工具箱' },
  { path: '/manual', label: '用户手册' },
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
    c.path ? matchPath(loc.pathname, { path: c.path, exact: false }) : false
  )
  return (
    <div className="nav-group">
      <div className={`nav-parent ${isChildActive ? 'active' : ''}`}>{item.label}</div>
      <div className="nav-sub">
        {item.children!.map(c =>
          c.path ? (
            <NavLink key={c.label} to={c.path} activeClassName="active" className="nav-sub-item">
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

function App() {
  const user = getCurrentUser()

  return (
    <ConfigProvider
      theme={{ token: { colorPrimary: '#3b82f6' } }}
      locale={zhCN}
    >
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">MechSim</div>
          <nav className="sidebar-nav">
            {navItems.map((item, i) =>
              item.path ? (
                <NavLink key={item.path} to={item.path} exact activeClassName="active" className="nav-item">
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
            <Switch>
              <Route path="/cases" component={CaseList} />
              <Route exact path="/" render={() => <Redirect to="/cases" />} />
              <Route path="/tasks" component={Tasks} />
              <Route path="/data/:taskId?" component={DataViewer} />
              <Route path="/data-manage" component={Placeholder} />
              <Route path="/tools" component={Placeholder} />
              <Route path="/manual" component={Placeholder} />
              <Route path="/indicators" component={Placeholder} />
              <Route path="/reports" component={Placeholder} />
              <Route path="/logs" component={Placeholder} />
              <Route path="*" render={() => <Redirect to="/cases" />} />
            </Switch>
          </main>
        </div>
      </div>
    </ConfigProvider>
  )
}

export default App
