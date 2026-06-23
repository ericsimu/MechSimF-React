import { useState, type ReactNode } from "react";
import { Switch, Route, Redirect, NavLink, useLocation } from "react-router-dom";
import { ConfigProvider, Button } from "antd";
import zhCN from "antd/locale/zh_CN";
import {
  AppstoreOutlined,
  ScheduleOutlined,
  LineChartOutlined,
  DatabaseOutlined,
  ToolOutlined,
  BookOutlined,
} from "@ant-design/icons";
import "./index.css";
import CaseList from "./pages/CaseList";
import Tasks from "./pages/Tasks";
import DataViewer from "./pages/DataViewer";
import DataWS from "./pages/DataWS";
import Placeholder from "./pages/Placeholder";
import Manual from "./pages/Manual";
import Login from "./pages/Login";
import { getCurrentUser, setCurrentUser, clearCurrentUser } from "./utils/user";
import { ALLOWED_USERS } from "./api/config";

const PREFIX = "";

interface NavChild { path?: string; label: string; icon?: ReactNode }
interface NavItem { path?: string; label: string; children?: NavChild[]; icon?: ReactNode; exact?: boolean }

const navItems: NavItem[] = [
  { path: `${PREFIX}/cases`, label: "用例编排", icon: <AppstoreOutlined /> },
  { path: `${PREFIX}/tasks`, label: "任务管理", icon: <ScheduleOutlined /> },
  { path: `${PREFIX}/data`, label: "数据可视化", icon: <LineChartOutlined />, exact: false },
  // {
  //   label: "结果分析", icon: <FundOutlined />, children: [
  //     { path: `${PREFIX}/data`, label: "数据可视化", icon: <LineChartOutlined /> },
  //     { path: `${PREFIX}/data-ws`, label: "工作路径数据", icon: <FolderOpenOutlined /> },
  //     { path: `${PREFIX}/indicators`, label: "指标查看", icon: <DashboardOutlined /> },
  //     { path: `${PREFIX}/reports`, label: "报告查看", icon: <FileTextOutlined /> },
  //     { path: `${PREFIX}/logs`, label: "日志查看", icon: <FileSearchOutlined /> },
  //   ],
  // },
  { path: `${PREFIX}/data-manage`, label: "数据管理", icon: <DatabaseOutlined /> },
  { path: `${PREFIX}/tools`, label: "工具箱", icon: <ToolOutlined /> },
  { path: `${PREFIX}/manual`, label: "用户手册", icon: <BookOutlined /> },
];

function NavGroup({ item }: { item: NavItem }) {
  const loc = useLocation();
  const isChildActive = item.children?.some(
    (c) => c.path && loc.pathname.startsWith(c.path),
  );
  return (
    <div className="m-0">
      <div className={`py-3 px-5 pt-3 pb-1 text-white/50 text-lg font-medium select-none ${isChildActive ? "active" : ""}`}>{item.icon && <span className="mr-2">{item.icon}</span>}{item.label}</div>
      <div className="pb-2">
        {item.children!.map((c) =>
          c.path ? (
            <NavLink key={c.label} to={c.path} activeClassName="active" className="block py-2.5 px-5 pb-2 pl-10 text-white/70 no-underline text-[15px] hover:text-white hover:bg-white/10 [&.active]:text-white [&.active]:font-medium">
              {c.icon && <span className="mr-1.5">{c.icon}</span>}{c.label}
            </NavLink>
          ) : (
            <span className="block py-2.5 px-5 pb-2 pl-10 text-white/70 no-underline text-[15px]" style={{ opacity: 0.5 }}>{c.label}</span>
          ),
        )}
      </div>
    </div>
  );
}

function MechSim() {
  // 从 localStorage 自动登录：仅当已存合法（在允许名单内）用户时直接进主界面，否则进登录页
  const [user, setUser] = useState(() => {
    const u = getCurrentUser();
    return ALLOWED_USERS.includes(u) ? u : "";
  });

  function handleLogin(u: string) {
    setCurrentUser(u); // 写入后续请求使用的 X-User
    setUser(u);
  }

  function logout() {
    clearCurrentUser();
    setUser(""); // 回到登录页
  }

  if (!user) {
    return (
      <ConfigProvider theme={{ token: { colorPrimary: "#3b82f6" } }} locale={zhCN}>
        <Login onLogin={handleLogin} />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#3b82f6" } }} locale={zhCN}>
      <div className="flex h-full overflow-hidden">
        <aside className="w-[200px] shrink-0 flex flex-col bg-gradient-to-b from-[#0f1b3d] via-[#1e3a8a] to-[#2563eb]">
          <div className="py-5 px-5 text-lg font-bold text-white tracking-[0.5px]">MechSim</div>
          <nav className="flex flex-col py-2">
            {navItems.map((item, i) =>
              item.path ? (
                <NavLink key={item.path} to={item.path} exact={item.exact ?? true} activeClassName="active" className="block py-3 px-5 text-white/85 no-underline text-lg cursor-pointer transition-[color,background] duration-150 hover:text-white hover:bg-white/[0.12] [&.active]:text-white [&.active]:font-semibold [&.active]:border [&.active]:border-white/50 [&.active]:rounded">
                  {item.icon && <span className="mr-2">{item.icon}</span>}{item.label}
                </NavLink>
              ) : (<NavGroup key={i} item={item} />),
            )}
          </nav>
          <div className="mt-auto py-3 px-5 text-xs text-white/60 border-t border-white/15" title="当前登录用户">{user}</div>
        </aside>
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <header className="py-3.5 px-6 bg-white border-b border-[#e8e8e8] flex items-center">
            <span className="text-sm text-[#333] font-medium">MechSim (机电仿真平台)</span>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[13px] text-[#888]">{user}</span>
              <Button size="small" onClick={logout}>
                退出登录
              </Button>
            </div>
          </header>
          <main key={user} className="flex-1 p-0 min-h-0 flex flex-col overflow-hidden">
            <Switch>
              <Route path={`${PREFIX}/cases`} component={CaseList} />
              <Route path={`${PREFIX}/tasks`} component={Tasks} />
              <Route path={`${PREFIX}/data-ws`} component={DataWS} />
              <Route path={`${PREFIX}/data/:taskId?`} component={DataViewer} />
              <Route path={`${PREFIX}/data-manage`} component={Placeholder} />
              <Route path={`${PREFIX}/tools`} component={Placeholder} />
              <Route path={`${PREFIX}/manual`} component={Manual} />
              <Route path={`${PREFIX}/indicators`} component={Placeholder} />
              <Route path={`${PREFIX}/reports`} component={Placeholder} />
              <Route path={`${PREFIX}/logs`} component={Placeholder} />
              <Redirect to={`${PREFIX}/cases`} />
            </Switch>
          </main>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default MechSim;
