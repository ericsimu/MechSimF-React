import { useState, useEffect, useMemo, useCallback } from "react";
import { getCase, queueModelInfo } from "@/api/index";
import { getCurrentUser } from "@/utils/user";
import type { ModelInfoMap, AddCaseRequest } from "@/types/api";

const PRODUCTIVITY_OPTIONS = ["100WPH", "150WPH", "200WPH", "295WPH", "340WPH"];
const VERSION_OPTIONS = ["3X", "5X"];

export function useCaseDetail(caseId: number, caseName: string, caseDescription: string) {
  const [editDraft, setEditDraft] = useState<Record<string, any>>({});
  const [modelInfo, setModelInfo] = useState<ModelInfoMap>({});

  const systems = useMemo(() => {
    const version = editDraft.model_verison || "3X";
    return Object.keys(modelInfo[version] || {});
  }, [modelInfo, editDraft.model_verison]);

  // ── Load case + model info ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cr = await getCase(caseId);
        if (cancelled || !cr.success || !cr.data) return;
        setEditDraft({ ...cr.data });
        try {
          const mr = await queueModelInfo();
          if (cancelled) return;
          if (mr.success && mr.data) setModelInfo(mr.data);
        } catch { /* */ }
      } catch { /* */ }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  // ── auto-set defaults on model tab ──
  const ensureModelDefaults = useCallback(() => {
    if (Object.keys(modelInfo).length === 0) {
      queueModelInfo().then(r => { if (r.success && r.data) setModelInfo(r.data); });
    }
    setEditDraft(prev => {
      const patch: Record<string, any> = {};
      if (!prev.model_productivity) patch.model_productivity = PRODUCTIVITY_OPTIONS[0];
      if (!prev.model_verison) patch.model_verison = VERSION_OPTIONS[0];
      return Object.keys(patch).length > 0 ? { ...prev, ...patch } : prev;
    });
  }, [modelInfo]);

  // ── handleDraftChange ──
  const handleDraftChange = useCallback(
    (patch: Record<string, any>) => {
      if ("model_verison" in patch && patch.model_verison !== editDraft.model_verison) {
        setEditDraft(prev => ({ ...prev, ...patch, sys_name: "", model_name: "", init_script: "" }));
      } else {
        setEditDraft(prev => ({ ...prev, ...patch }));
      }
    },
    [editDraft.model_verison],
  );

  // ── buildBody ──
  const buildBody = useCallback((): AddCaseRequest => {
    const src: Record<string, any> = { ...editDraft };
    return {
      name: caseName,
      description: caseDescription,
      create_by: src.create_by || getCurrentUser(),
      sys_name: src.sys_name || "",
      model_name: src.model_name || "",
      init_script: src.init_script || "",
      model_verison: src.model_verison || "",
      model_productivity: src.model_productivity || "",
      model_param: src.model_param || "",
      sim_time: src.sim_time ?? null,
      sim_step: src.sim_step ?? null,
      flow_instance_id: src.flow_instance_id || "",
    };
  }, [editDraft, caseName, caseDescription]);

  return {
    editDraft, setEditDraft,
    modelInfo, setModelInfo,
    systems,
    buildBody,
    handleDraftChange,
    ensureModelDefaults,
  };
}
