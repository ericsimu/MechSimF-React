import { useState } from "react";
import { Select, Input, message } from "antd";
import { API_BASE } from "../api/config";

const PRODUCTIVITY_OPTIONS = ["100WPH", "150WPH"];
const VERSION_OPTIONS = ["3X", "5X"];

interface Props {
  systems: string[];
  draft: Record<string, any>;
  onSysChange: (sys: string) => void;
  onDraftChange: (patch: Record<string, any>) => void;
}

function ModelImage({ sysName }: { sysName: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div
        style={{
          width: "100%",
          height: 160,
          marginTop: 12,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#999",
          fontSize: 13,
        }}
      >
        没有相关图片
      </div>
    );
  return (
    <div
      style={{
        width: "100%",
        marginTop: 12,
        borderRadius: 6,
        overflow: "hidden",
        background: "#fafafa",
      }}
    >
      <img
        key={sysName}
        src={`${API_BASE}/model_image/${sysName}`}
        alt={`${sysName} model`}
        style={{
          width: "100%",
          maxHeight: "360px",
          objectFit: "contain",
          display: "block",
        }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default function ModelSelectPanel({
  systems,
  draft,
  onSysChange,
  onDraftChange,
}: Props) {
  return (
  <div className="model-select-panel">
    <div className="select-row">
      <div className="select-group" style={{ flex: 1, minWidth: 0 }}>
        <label className="select-label">系统选择</label>
        <Select
          style={{ width: "100%" }}
          value={draft.sys_name || undefined}
          onChange={onSysChange}
          placeholder="请选择系统"
          options={systems.map((s) => ({ value: s, label: s }))}
        />
      </div>
      <div className="select-group" style={{ flex: 1, minWidth: 0 }}>
        <label className="select-label">产率</label>
        <Select
          style={{ width: "100%" }}
          value={draft.model_productivity || undefined}
          onChange={(v) => onDraftChange({ model_productivity: v })}
          options={PRODUCTIVITY_OPTIONS.map((o) => ({ value: o, label: o }))}
        />
      </div>
      <div className="select-group" style={{ flex: 1, minWidth: 0 }}>
        <label className="select-label">版本</label>
        <Select
          style={{ width: "100%" }}
          value={draft.model_verison || undefined}
          onChange={(v) => onDraftChange({ model_verison: v })}
          options={VERSION_OPTIONS.map((o) => ({ value: o, label: o }))}
        />
      </div>
      <div className="select-group" style={{ flex: 1, minWidth: 0 }}>
        <label className="select-label">仿真时间 (s)</label>
        <Input
          type="number"
          placeholder="留空使用默认值"
          value={draft.sim_time ?? ""}
          onChange={(e) =>
            onDraftChange({
              sim_time: e.target.value ? Number(e.target.value) : null,
            })
          }
          onBlur={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v > 0 && v > 19.2) {
              onDraftChange({ sim_time: 19.2 });
              message.error("仿真时间不能超过 19.2s，已自动修正");
            }
          }}
        />
      </div>
    </div>
    {draft.sys_name && <ModelImage key={draft.sys_name} sysName={draft.sys_name} />}
  </div>
  );
}


