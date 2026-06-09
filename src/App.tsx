import { Routes, Route, Navigate, NavLink } from "react-router-dom";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import Home from "./mechSim/pages/Home";
import MechSim from "./mechSim";
import Settings from "./mechSim/pages/Settings";
import { getCurrentUser } from "./mechSim/utils/user";
import "./App.css";

function App() {
  const user = getCurrentUser();

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#3b82f6" } }} locale={zhCN}>
      <div className="parent-shell">
        <header className="top-nav">
          <span className="top-nav-brand">MechSim</span>
          <nav className="top-nav-links">
            <NavLink to="/" end className={({ isActive }) => `top-nav-item${isActive ? " active" : ""}`}>首页</NavLink>
            <NavLink to="/mechsim" className={({ isActive }) => `top-nav-item${isActive ? " active" : ""}`}>仿真平台</NavLink>
            <NavLink to="/settings" end className={({ isActive }) => `top-nav-item${isActive ? " active" : ""}`}>设置</NavLink>
          </nav>
          <span className="top-nav-user">{user}</span>
        </header>
        <div className="parent-body">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/mechsim" element={<Navigate to="/mechsim/cases" replace />} />
            <Route path="/mechsim/*" element={<MechSim />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default App;
