import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { Tabs, message } from "antd";
import type { AddCaseRequest } from "@/types/api";
import { updateCase } from "@/api/index";
import { useCaseDetail } from "@/hooks/useCaseDetail";
import ModelSelectPanel from "@/components/ModelSelectPanel";
import ParamTab, { type ParamTabHandle } from "@/components/ParamTab";
import DisturbTab, { type DisturbTabHandle } from "@/components/DisturbTab";
import SweepTab from "@/components/SweepTab";

export interface ModelTabHandle {
  getCaseBody: () => AddCaseRequest;
  save: (silent?: boolean) => Promise<boolean>;
}

interface Props {
  caseId: number;
  caseName: string;
  caseDescription: string;
  onSaved: (body: AddCaseRequest) => void;
}

function ModelTab({ caseId, caseName, caseDescription, onSaved }: Props, ref: React.Ref<ModelTabHandle>) {
  const [activeTab, setActiveTab] = useState("model");
  const { editDraft, setEditDraft, modelInfo, systems, buildBody, handleDraftChange, ensureModelDefaults } =
    useCaseDetail(caseId, caseName, caseDescription);
  const disturbRef = useRef<DisturbTabHandle>(null);
  const paramRef = useRef<ParamTabHandle>(null);

  const getCaseBody = useCallback((): AddCaseRequest => {
    const body = buildBody();
    // 以参数树为准重建 model_param —— 兜底，杜绝 editDraft.model_param 未同步导致保存为空
    const rebuilt = paramRef.current?.getModelParam();
    if (rebuilt) body.model_param = rebuilt;
    // 合并扰动：从 DisturbTab 读取当前勾选，写入 model_param
    const names = disturbRef.current?.getCheckedFileNames() || [];
    if (names.length > 0) {
      const ver = editDraft.model_verison || "3X";
      const sys = editDraft.sys_name;
      try {
        const mp = JSON.parse(body.model_param || "{}");
        if (!mp[ver]) mp[ver] = {};
        if (!mp[ver][sys]) mp[ver][sys] = {};
        mp[ver][sys].DisturbanceFiles = names;
        body.model_param = JSON.stringify(mp);
      } catch { /* */ }
    }
    return body;
  }, [buildBody, editDraft.model_verison, editDraft.sys_name]);

  // save 用 getCaseBody 重建后的 body 写库，保证 DB 与差异弹窗一致
  const save = useCallback(async (silent = false): Promise<boolean> => {
    const body = getCaseBody();
    try {
      const r = await updateCase(caseId, body);
      if (r.success) { onSaved(body); if (!silent) message.success("保存成功"); return true; }
      message.error(r.message || "保存失败");
      return false;
    } catch { message.error("保存失败"); return false; }
  }, [caseId, getCaseBody, onSaved]);

  useImperativeHandle(ref, () => ({ getCaseBody, save }),
    [getCaseBody, save]);

  // 初始加载时补上默认版本和生产力
  useEffect(() => { ensureModelDefaults(); }, [ensureModelDefaults]);

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
    if (key === "model") ensureModelDefaults();
  }, [ensureModelDefaults]);

  const onSysChange = useCallback((sys: string) => {
    setEditDraft(prev => {
      const ver = prev.model_verison || "3X";
      // 解析已有 model_param
      let mp: Record<string, any> = {};
      try { mp = JSON.parse(prev.model_param || "{}"); } catch { /* */ }
      if (!mp[ver]) mp[ver] = {};
      // 为当前系统/版本注入默认 DisturbanceFiles（来自 modelInfo）
      if (!mp[ver][sys] || typeof mp[ver][sys] !== "object" || Array.isArray(mp[ver][sys])) {
        mp[ver][sys] = {};
      }
      const sysEntry = (modelInfo as any)?.[ver]?.[sys];
      const dfRaw = sysEntry?.DisturbanceFiles;
      let defaultFiles: string[] = [];
      if (dfRaw) {
        defaultFiles = Array.isArray(dfRaw)
          ? dfRaw.map((f: any) => String(f).trim()).filter(Boolean)
          : typeof dfRaw === "string"
            ? dfRaw.split(",").map((f: string) => f.trim()).filter(Boolean)
            : [];
      }
      // 仅在当前系统还没有 DisturbanceFiles 时写入默认值，保留已保存的用户自定义
      if (!mp[ver][sys].DisturbanceFiles || (Array.isArray(mp[ver][sys].DisturbanceFiles) && mp[ver][sys].DisturbanceFiles.length === 0)) {
        mp[ver][sys].DisturbanceFiles = defaultFiles;
      }
      return { ...prev, sys_name: sys, model_name: sys, init_script: sys, model_param: JSON.stringify(mp) };
    });
  }, [setEditDraft, modelInfo]);

  const tabItems = useMemo(() => [
    {
      key: "model", label: "模型选择",
      children: (
        <div className="flex-1 overflow-y-auto overflow-x-hidden box-border px-4 py-3 min-w-0 min-h-0">
          <ModelSelectPanel systems={systems} draft={editDraft}
            onSysChange={onSysChange} onDraftChange={handleDraftChange} />
        </div>
      ),
    },
    {
      key: "param", label: "参数配置",
      children: <ParamTab ref={paramRef} systems={systems} editDraft={editDraft} setEditDraft={setEditDraft} modelInfo={modelInfo} setActiveTab={setActiveTab} />,
      forceRender: true,
    },
    {
      key: "disturb", label: "扰动选择",
      children: <DisturbTab ref={disturbRef} setEditDraft={setEditDraft} setActiveTab={setActiveTab} modelInfo={modelInfo} sysName={editDraft.sys_name} modelVersion={editDraft.model_verison} modelParam={editDraft.model_param} />,
    },
    {
      key: "sweep", label: "参数扫描",
      children: <SweepTab caseId={caseId} modelInfo={modelInfo}
        modelVersion={editDraft.model_verison} sysName={editDraft.sys_name}
        enableSharding={!!editDraft.enable_sharding} />,
    },
  ], [systems, editDraft, modelInfo, setEditDraft, setActiveTab, onSysChange, handleDraftChange]);

  return (
    <Tabs className="edit-tabs" activeKey={activeTab} onChange={handleTabChange} items={tabItems} />
  );
}

export default forwardRef(ModelTab);
