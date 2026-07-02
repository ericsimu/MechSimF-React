import { useState, type ReactNode } from "react";
import { Switch, Route, Redirect, NavLink, useLocation, useHistory } from "react-router-dom";
import { ConfigProvider, Button } from "antd";
import zhCN from "antd/locale/zh_CN";
import {
  AppstoreOutlined,
  ScheduleOutlined,
  LineChartOutlined,
  DatabaseOutlined,
  ToolOutlined,
  BookOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import Home from "./pages/Home";
import CaseList from "./pages/CaseList";
import Tasks, { savedTaskSelection } from "./pages/Tasks";
import DataViewer from "./pages/DataViewer";
import DataWS from "./pages/DataWS";
import Placeholder from "./pages/Placeholder";
import Manual from "./pages/Manual";
import Login from "./pages/Login";
import { getCurrentUser, setCurrentUser, clearCurrentUser } from "./utils/user";
import DataManage from "./pages/DataManage";
import { ALLOWED_USERS } from "./api/config";

const PREFIX = "";

interface NavChild { path?: string; label: string; icon?: ReactNode }
interface NavItem { path?: string; label: string; children?: NavChild[]; icon?: ReactNode; exact?: boolean }

const navItems: NavItem[] = [
  { path: `${PREFIX}/`, label: "主页", icon: <HomeOutlined />, exact: true },
  { path: `${PREFIX}/cases`, label: "用例编排", icon: <AppstoreOutlined /> },
  { path: `${PREFIX}/tasks`, label: "任务管理", icon: <ScheduleOutlined /> },
  { path: `${PREFIX}/data`, label: "结果查看", icon: <LineChartOutlined />, exact: false },
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
  const history = useHistory();
  const [user, setUser] = useState(() => {
    const u = getCurrentUser();
    return ALLOWED_USERS.includes(u) ? u : "";
  });
  const [collapsed, setCollapsed] = useState(false);

  function handleLogin(u: string) {
    setCurrentUser(u); // 写入后续请求使用的 X-User
    setUser(u);
    history.push("/");
  }

  function logout() {
    clearCurrentUser();
    savedTaskSelection.length = 0; // 清空跨用户的任务选中记忆
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
      <style>{`
        :root {
          --c-primary: #3b82f6; --c-success: #10b981; --c-warning: #f59e0b;
          --c-danger: #ef4444; --c-text: #333; --c-muted: #888;
          --c-border: #f0f0f0; --c-bg: #f7f8fa; --c-card: #fff;
        }
        html,body,#root { height:100%; width:100%; overflow:hidden; }
        body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:14px; line-height:1.5; color:#333; background:#fff; -webkit-font-smoothing:antialiased; }
        .ant-table-wrapper { height:100%; }
        .ant-table { font-size:13px!important; }
        .ant-btn { border-radius:6px!important; }
        .ant-btn-primary { box-shadow:0 1px 2px rgba(59,130,246,0.2); }
        .ant-btn-sm,.ant-input-sm,.ant-select-sm { font-size:12px!important; }
        .ant-table-row:hover>td { background:#f0f5ff!important; transition:background 0.15s; }
        .ant-table-row:nth-child(even)>td { background:#fafbfc; }
        .sidebar-collapsible { transition:width 0.5s cubic-bezier(0.34,1.56,0.64,1.1); }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .page-title { position:relative; padding-left:14px; }
        .page-title::before { content:""; position:absolute; left:0; top:2px; bottom:2px; width:3px; background:#3b82f6; border-radius:2px; }
        .edit-left::-webkit-scrollbar,.edit-right::-webkit-scrollbar,.sidebar-list::-webkit-scrollbar { width:6px; height:6px; }
        .edit-left::-webkit-scrollbar-track,.edit-right::-webkit-scrollbar-track,.sidebar-list::-webkit-scrollbar-track { background:transparent; }
        .edit-left::-webkit-scrollbar-thumb,.edit-right::-webkit-scrollbar-thumb,.sidebar-list::-webkit-scrollbar-thumb { background:#d9d9d9; border-radius:3px; }
        .edit-left::-webkit-scrollbar-thumb:hover,.edit-right::-webkit-scrollbar-thumb:hover,.sidebar-list::-webkit-scrollbar-thumb:hover { background:#bbb; }
      `}</style>
      <div className="flex h-full overflow-hidden">
        <aside className="sidebar-collapsible shrink-0 flex flex-col bg-gradient-to-b from-[#0f1b3d] via-[#1e3a8a] to-[#2563eb] relative"
      style={{ width: collapsed ? 56 : 200 }}>
          <div className="py-4 flex items-center justify-center select-none">
            <img src="/MechSimIcon.png" alt="MechSim" className="w-7 h-7" />
            <span className={`text-white font-bold ml-2 text-base transition-opacity duration-200 ${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}>MechSim</span>
          </div>
          {/* 折叠按钮 — 圆形，悬浮在侧边栏右边缘 */}
          <button
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-[#f0f0f0] shadow-sm flex items-center justify-center text-[#666] hover:text-[#3b82f6] hover:border-[#3b82f6] hover:shadow transition-all duration-300 z-20 cursor-pointer"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "展开菜单" : "收起菜单"}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className="transition-transform duration-300" style={{ transform: collapsed ? "none" : "scaleX(-1)" }}><path d="M2 1L8 5L2 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <nav className="flex flex-col py-2">
            {navItems.map((item, i) =>
              item.path ? (
                <NavLink
                  key={item.path}
                  to={item.path}
                  exact={item.exact ?? true}
                  activeClassName="active"
                  title={collapsed ? item.label : undefined}
                  className={`block py-3 text-white/80 no-underline text-[16px] cursor-pointer transition-[color,background] duration-200 border-l-[3px] border-l-transparent hover:text-white hover:bg-white/[0.08] whitespace-nowrap [&.active]:text-white [&.active]:font-semibold [&.active]:bg-white/[0.12] [&.active]:border-l-white ${collapsed ? "px-0 flex justify-center" : "pl-[17px] pr-5"}`}
                  onClick={(e) => {
                    if (item.path === `${PREFIX}/data` && savedTaskSelection.length > 0) {
                      e.preventDefault();
                      history.push(`/data?ids=${savedTaskSelection.map(String).join(",")}`);
                    }
                  }}
                >
                  {item.icon && (collapsed ? item.icon : <span className="mr-2">{item.icon}</span>)}
                  <span className={`transition-opacity duration-200 ${collapsed ? "hidden" : ""}`}>{item.label}</span>
                </NavLink>
              ) : (<NavGroup key={i} item={item} />),
            )}
          </nav>
          <div className={`mt-auto py-3 border-t border-white/15 text-[10px] text-white/50 text-center transition-opacity duration-200 ${collapsed ? "opacity-0" : "opacity-100"}`} title="当前登录用户">
            {user}
          </div>
        </aside>
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <header className="py-5 px-6 flex items-center z-10" style={{ background: "linear-gradient(135deg, #eef4fb 0%, #f6f9fe 50%, #edf3fa 100%)", borderBottom: "1px solid #dce6f2", boxShadow: "0 1px 3px rgba(59,130,246,0.05)" }}>
            <span className="text-base text-[#1e3a5f] font-medium">MechSim (机电仿真平台)</span>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[13px] text-[#888]">{user}</span>
              <Button size="small" onClick={logout}>
                退出登录
              </Button>
            </div>
          </header>
          <main key={`${user}-${location.pathname}`} className="flex-1 p-0 min-h-0 flex flex-col overflow-hidden" style={{ animation: "fadeIn 0.2s ease-out" }}>
            <Switch>
              <Route path={`${PREFIX}/`} exact component={Home} />
              <Route path={`${PREFIX}/cases`} component={CaseList} />
              <Route path={`${PREFIX}/tasks`} component={Tasks} />
              <Route path={`${PREFIX}/data-ws`} component={DataWS} />
              <Route path={`${PREFIX}/data`} component={DataViewer} />
              <Route path={`${PREFIX}/data-manage`} component={DataManage} />
              <Route path={`${PREFIX}/tools`} component={Placeholder} />
              <Route path={`${PREFIX}/manual`} component={Manual} />
              <Route path={`${PREFIX}/indicators`} component={Placeholder} />
              <Route path={`${PREFIX}/reports`} component={Placeholder} />
              <Route path={`${PREFIX}/logs`} component={Placeholder} />
              <Redirect to={`${PREFIX}/`} />
            </Switch>
          </main>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default MechSim;
