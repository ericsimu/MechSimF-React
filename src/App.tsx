import { Routes, Route, Navigate, NavLink } from "react-router-dom";
import type { ComponentType } from "react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import Home from "./mechSim/pages/Home";
import MechSim from "./mechSim";
import Settings from "./mechSim/pages/Settings";
import { getCurrentUser } from "./mechSim/utils/user";
import "./App.css";

interface RouteConfig {
  path: string;
  label: string;
  component: ComponentType<any>;
  exact?: boolean;
  wildcard?: boolean;
}

const routes: RouteConfig[] = [
  { path: "/", label: "首页", component: Home },
  { path: "/settings", label: "设置", component: Settings },
  {
    path: "/mechsim",
    label: "仿真平台",
    component: MechSim,
    wildcard: true,
  },
];

function App() {
  const user = getCurrentUser();

  return (
    <ConfigProvider
      theme={{ token: { colorPrimary: "#3b82f6" } }}
      locale={zhCN}
    >
      <div className="parent-shell">
        <header className="top-nav">
          <span className="top-nav-brand">MechSim</span>
          <nav className="top-nav-links">
            {routes.map((r) => (
              <NavLink
                key={r.path}
                to={r.path}
                end={r.exact}
                className={({ isActive }) =>
                  `top-nav-item${isActive ? " active" : ""}`
                }
              >
                {r.label}
              </NavLink>
            ))}
          </nav>
          <span className="top-nav-user">{user}</span>
        </header>

        <div className="parent-body">
          <Routes>
            {/* 普通页面：不包含 wildcard 路由（wildcard 单独处理） */}
            {routes
              .filter((r) => !r.wildcard)
              .map((r) => {
                const Comp = r.component;
                return <Route key={r.path} path={r.path} element={<Comp />} />;
              })}

            {/* MechSim: 只通过 /mechsim/* 承接子路由，裸 /mechsim 重定向 */}
            <Route
              path="/mechsim"
              element={<Navigate to="/mechsim/cases" replace />}
            />
            <Route path="/mechsim/*" element={<MechSim />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default App;
