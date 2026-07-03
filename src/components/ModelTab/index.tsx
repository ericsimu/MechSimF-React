import { useState, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { Tabs } from "antd";
import type { AddCaseRequest } from "@/types/api";
import { useCaseDetail } from "@/hooks/useCaseDetail";
import ModelSelectPanel from "@/components/ModelSelectPanel";
import ParamTab from "@/components/ParamTab";
import DisturbTab from "@/components/DisturbTab";

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
  const { editDraft, setEditDraft, modelInfo, systems, buildBody, save, handleDraftChange, ensureModelDefaults } =
    useCaseDetail(caseId, caseName, caseDescription, onSaved);

  useImperativeHandle(ref, () => ({ getCaseBody: buildBody, save }),
    [buildBody, save]);

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
    if (key === "model") ensureModelDefaults();
  }, [ensureModelDefaults]);

  const onSysChange = useCallback((sys: string) => {
    setEditDraft(prev => ({ ...prev, sys_name: sys, model_name: sys, init_script: sys }));
  }, [setEditDraft]);

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
      children: <ParamTab systems={systems} editDraft={editDraft} setEditDraft={setEditDraft} modelInfo={modelInfo} setActiveTab={setActiveTab} />,
    },
    {
      key: "disturb", label: "扰动选择",
      children: <DisturbTab setEditDraft={setEditDraft} setActiveTab={setActiveTab} modelInfo={modelInfo} sysName={editDraft.sys_name} modelVersion={editDraft.model_verison} modelParam={editDraft.model_param} />,
    },
  ], [systems, editDraft, modelInfo, setEditDraft, setActiveTab, onSysChange, handleDraftChange]);

  return (
    <Tabs className="edit-tabs" activeKey={activeTab} onChange={handleTabChange} items={tabItems} />
  );
}

export default forwardRef(ModelTab);
