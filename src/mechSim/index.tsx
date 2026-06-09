import { Outlet, NavLink, useLocation } from "react-router-dom";
import "./index.css";
import { getCurrentUser } from "./utils/user";

interface NavChild {
  path?: string;
  label: string;
}
interface NavItem {
  path?: string;
  label: string;
  children?: NavChild[];
}

const navItems: NavItem[] = [
  { path: "cases", label: "用例编排" },
  { path: "tasks", label: "任务管理" },
  {
    label: "结果分析",
    children: [
      { path: "data", label: "数据可视化" },
      { path: "indicators", label: "指标查看" },
      { path: "reports", label: "报告查看" },
      { path: "logs", label: "日志查看" },
    ],
  },
  { path: "data-manage", label: "数据管理" },
  { path: "tools", label: "工具箱" },
  { path: "manual", label: "用户手册" },
];

function NavGroup({ item }: { item: NavItem }) {
  const loc = useLocation();
  const isChildActive = item.children?.some(
    (c) => c.path && loc.pathname.split("/").filter(Boolean).includes(c.path),
  );
  return (
    <div className="nav-group">
      <div className={`nav-parent ${isChildActive ? "active" : ""}`}>
        {item.label}
      </div>
      <div className="nav-sub">
        {item.children!.map((c) =>
          c.path ? (
            <NavLink
              key={c.label}
              to={c.path}
              className={({ isActive }) =>
                `nav-sub-item${isActive ? " active" : ""}`
              }
            >
              {c.label}
            </NavLink>
          ) : (
            <span className="nav-sub-item" style={{ opacity: 0.5 }}>
              {c.label}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

function MechSim() {
  const user = getCurrentUser();

  return (
    <div className="app-shell mechsim-app">
      <aside className="sidebar">
        <div className="sidebar-brand">MechSim</div>
        <nav className="sidebar-nav">
          {navItems.map((item, i) =>
            item.path ? (
              <NavLink
                key={item.path}
                to={item.path}
                end
                className={({ isActive }) =>
                  `nav-item${isActive ? " active" : ""}`
                }
              >
                {item.label}
              </NavLink>
            ) : (
              <NavGroup key={i} item={item} />
            ),
          )}
        </nav>
        <div className="sidebar-user" title="当前登录用户">
          {user}
        </div>
      </aside>
      <div className="app-body">
        <header className="app-header">
          <span className="header-breadcrumb">MechSim (机电仿真平台)</span>
          <span className="header-user">{user}</span>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MechSim;
