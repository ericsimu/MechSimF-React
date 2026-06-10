import { Switch, Route, Redirect, NavLink } from "react-router-dom";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import Home from "./pages/Home";
import MechSim from "./mechSim";
import Settings from "./pages/Settings";
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
            <NavLink to="/" exact activeClassName="active" className="top-nav-item">首页</NavLink>
            <NavLink to="/mechsim/cases" activeClassName="active" className="top-nav-item">仿真平台</NavLink>
            <NavLink to="/settings" exact activeClassName="active" className="top-nav-item">设置</NavLink>
          </nav>
          <span className="top-nav-user">{user}</span>
        </header>
        <div className="parent-body">
          <Switch>
            <Route exact path="/" component={Home} />
            <Route path="/settings" component={Settings} />
            {/* MechSim 内部有自己的 Routes（绝对路径），父级只做入口匹配 */}
            <Route path="/mechsim" component={MechSim} />
            <Redirect to="/" />
          </Switch>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default App;
