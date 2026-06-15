import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import MechSim from "./mechSim";

function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#3b82f6" } }} locale={zhCN}>
      <MechSim />
    </ConfigProvider>
  );
}

export default App;
