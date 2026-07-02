import { useHistory } from "react-router-dom";
import {
  AppstoreOutlined,
  DatabaseOutlined,
  ToolOutlined,
  BookOutlined,
} from "@ant-design/icons";

const cards = [
  {
    title: "仿真用例",
    desc: "创建和编排仿真用例，配置模型参数与扰动方案",
    icon: <AppstoreOutlined />,
    route: "/cases",
    color: "#3b82f6",
  },
  {
    title: "数据管理",
    desc: "管理仿真原始数据，导入导出与预处理",
    icon: <DatabaseOutlined />,
    route: "/data-manage",
    color: "#10b981",
  },
  {
    title: "工具箱",
    desc: "仿真辅助工具集，提升建模与分析效率",
    icon: <ToolOutlined />,
    route: "/tools",
    color: "#f59e0b",
  },
  {
    title: "用户手册",
    desc: "平台使用指南与仿真操作文档",
    icon: <BookOutlined />,
    route: "/manual",
    color: "#8b5cf6",
  },
];

export default function Home() {
  const history = useHistory();

  return (
    <div className="flex-1 flex flex-col justify-center bg-[#0c1529] overflow-hidden">
      {/* 品牌区 */}
      <div className="shrink-0 flex flex-col items-center pt-1 pb-8">
        <img
          src="/MechSimIcon.png"
          alt="MechSim"
          className="w-14 h-14 mb-3"
        />
        <h1 className="text-[26px] font-bold text-white tracking-tight mb-1">
          MechSim
        </h1>
        <p className="text-[13px] text-[#6b7fa8] text-center">
          机电仿真平台 — 一站式仿真用例管理、数据分析与结果可视化
        </p>
      </div>

      {/* 导航卡片 */}
      <div className="shrink-0 flex justify-center px-8 pb-10">
        <div className="w-full max-w-[600px] grid grid-cols-2 gap-5">
          {cards.map((c) => (
            <div
              key={c.route}
              onClick={() => history.push(c.route)}
              className="group cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.06] p-5 transition-all duration-300 hover:bg-white/[0.12] hover:border-white/[0.15] hover:-translate-y-0.5"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-3 transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: c.color + "25", color: c.color }}
              >
                {c.icon}
              </div>
              <h3 className="text-[15px] font-semibold text-white mb-1">
                {c.title}
              </h3>
              <p className="text-[12px] text-[#6b7fa8] leading-relaxed">
                {c.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
