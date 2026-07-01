import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./tailwind.css";
import MechSim from "./mechSim";

// 子路径部署时，在 vite.config.ts 设 base，构建后 BASE_URL 自动生效
createRoot(document.getElementById("root")!).render(
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <MechSim />
  </BrowserRouter>,
);
