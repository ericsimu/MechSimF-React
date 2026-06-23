import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import DataViewerWS from "./DataViewerWS";

/** 工作路径数据查看页：从 ?workspace= 取工作路径，渲染独立的 DataViewerWS 模块。 */
export default function DataWS() {
  const location = useLocation();
  const workspace = new URLSearchParams(location.search).get("workspace") || "";

  useEffect(() => {
    console.log("工作路径:", workspace);
  }, [workspace]);

  return (
    <div className="h-[calc(100vh-49px)] flex flex-col p-4">
      <DataViewerWS workspace={workspace} />
    </div>
  );
}
