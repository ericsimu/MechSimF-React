import type {
  ApiResponse,
  CaseModel,
  SimTask,
  AddCaseRequest,
  UpdateCaseRequest,
  CaseShare,
  DisturbanceInfo,
  ModelInfoMap,
  DisturbanceDirNode,
  DisturbanceColumn,
  SimPayload,
  SummaryCsvOptions,
  SweepModel,
  SweepRequest,
} from '@/types/api';
import { isNil } from '@/utils/isNil';
import { getCurrentUser } from '@/utils/user';
import { API_BASE } from '@/api/config';

async function request<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      "Content-Type": "application/json",
      "X-User": getCurrentUser(),
      ...(options.headers as Record<string, string>),
    },
    ...options,
  });
  const data: ApiResponse<T> = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `HTTP ${res.status}: ${res.statusText}`);
  }
  return data;
}

export async function queueCases(): Promise<ApiResponse<CaseModel[]>> {
  return await request<CaseModel[]>("/queue_cases");
}

export async function getCase(id: number): Promise<ApiResponse<CaseModel>> {
  return await request<CaseModel>(`/get_case/${id}`);
}

export async function queueCase(
  flowInstanceId: string,
): Promise<ApiResponse<CaseModel>> {
  return await request<CaseModel>(
    `/queue_case/${encodeURIComponent(flowInstanceId)}`,
  );
}

export async function addCase(
  body: AddCaseRequest,
): Promise<ApiResponse<{ id: number }>> {
  return await request("/add_case", { method: "POST", body: JSON.stringify(body) });
}

export async function updateCase(
  id: number,
  body: UpdateCaseRequest,
): Promise<ApiResponse> {
  return await request(`/update_case/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function updateCaseByFlow(
  flowInstanceId: string,
  body: UpdateCaseRequest,
): Promise<ApiResponse> {
  return await request(
    `/update_case_by_flow/${encodeURIComponent(flowInstanceId)}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
  );
}

export async function queueModelInfo(): Promise<ApiResponse<ModelInfoMap>> {
  return await request<ModelInfoMap>("/queue_model_info", { method: "POST" });
}

export async function queueDisturbances(): Promise<ApiResponse<DisturbanceDirNode>> {
  return await request<DisturbanceDirNode>("/queue_disturbances");
}

export async function getDisturbanceInfo(
  filePath: string,
): Promise<ApiResponse<DisturbanceInfo>> {
  return await request<DisturbanceInfo>("/get_disturbance_info", {
    method: "POST",
    body: JSON.stringify({ file_path: filePath }),
  });
}

export async function shareCase(
  caseId: number,
  sharedToUser: string,
): Promise<ApiResponse> {
  return await request(`/share_case/${caseId}`, {
    method: "POST",
    body: JSON.stringify({ shared_to_user: sharedToUser }),
  });
}

export async function unshareCase(
  caseId: number,
  sharedToUser: string,
): Promise<ApiResponse> {
  return await request(`/unshare_case/${caseId}`, {
    method: "POST",
    body: JSON.stringify({ shared_to_user: sharedToUser }),
  });
}

export async function getCaseShares(
  caseId: number,
): Promise<ApiResponse<CaseShare[]>> {
  return await request<CaseShare[]>(`/case_shares/${caseId}`);
}

export async function diffCase(
  id: number,
  body: UpdateCaseRequest,
): Promise<ApiResponse<Record<string, unknown>>> {
  return await request(`/diff_case/${id}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function addTasks(
  caseId: number,
  paramDiff?: string,
): Promise<ApiResponse<{ task_ids: number[] }>> {
  return await request("/add_tasks", {
    method: "POST",
    body: JSON.stringify({ case_id: caseId, param_diff: paramDiff || "" }),
  });
}

export async function getSimPayload(
  caseId: number,
): Promise<ApiResponse<SimPayload>> {
  return await request<SimPayload>(`/get_sim_payload/${caseId}`);
}

export async function queueTasks(): Promise<ApiResponse<SimTask[]>> {
  return await request<SimTask[]>("/queue_tasks");
}

export async function runTasks(
  taskIds: number[],
): Promise<ApiResponse<{ submitted: number[] }>> {
  return await request("/run_tasks", {
    method: "POST",
    body: JSON.stringify({ task_ids: taskIds }),
  });
}

export async function deleteTask(id: number): Promise<ApiResponse> {
  return await request(`/delete_task/${id}`, { method: "DELETE" });
}

export async function cancelTask(
  id: number,
): Promise<ApiResponse<{ task_id: number; cancelled: boolean }>> {
  return await request(`/cancel_task/${id}`, { method: "POST" });
}

export async function getTaskStatus(
  id: number,
): Promise<
  ApiResponse<{
    task_id: number;
    status: string;
    result: unknown;
    error?: string;
  }>
> {
  return await request(`/get_task_status/${id}`);
}

export async function getTaskData(
  taskId: number,
): Promise<
  ApiResponse<{
    columns: DisturbanceColumn[];
    fft_columns?: DisturbanceColumn[];
    task_status: string;
  }>
> {
  return await request(`/task_data/${taskId}`);
}

export async function getTaskDataColumns(
  taskId: number,
): Promise<
  ApiResponse<{
    column_names: string[];
    fft_column_names?: string[];
    task_status: string;
  }>
> {
  return await request(`/task_data/${taskId}?names_only=true`);
}

export async function getTaskIndication(
  taskId: number,
  iterName = "",
): Promise<ApiResponse<{ tables: { key: string; label: string; headers: string[]; rows: string[][] }[] }>> {
  const qs = iterName ? `?iter_name=${encodeURIComponent(iterName)}` : "";
  return await request(`/task_data/${taskId}/indication${qs}`);
}

export async function getTaskSignals(
  taskId: number,
  signalNames: string[],
  domain: string,
  start?: number,
  end?: number,
  raw?: boolean,
  iterName = "",
): Promise<ApiResponse<{ columns: DisturbanceColumn[] }>> {
  const body: Record<string, unknown> = { signal_names: signalNames, domain };
  if (!isNil(start) && !isNil(end)) {
    body.start = start;
    body.end = end;
  }
  if (raw) {
    body.raw = true;
  }
  if (iterName) {
    body.iter_name = iterName;
  }
  return await request(`/task_data/${taskId}/signals`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Workspace-based variants (read by workspace path, not task id) ──

export async function getWorkspaceData(
  workspace: string,
): Promise<
  ApiResponse<{
    columns: DisturbanceColumn[];
    column_names: string[];
    fft_column_names?: string[];
  }>
> {
  return await request(
    `/workspace_data?workspace=${encodeURIComponent(workspace)}`,
  );
}

export async function getWorkspaceDataColumns(
  workspace: string,
): Promise<
  ApiResponse<{
    column_names: string[];
    fft_column_names?: string[];
  }>
> {
  return await request(
    `/workspace_data?workspace=${encodeURIComponent(workspace)}&names_only=true`,
  );
}

// ── 数据管理 ──

export async function uploadRawData(
  file: File,
): Promise<ApiResponse<{ temp_path: string; filename: string }>> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/upload_raw_data`, {
    method: "POST",
    headers: { "X-User": getCurrentUser() },
    body: formData,
  });
  const data: ApiResponse<{ temp_path: string; filename: string }> = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  return data;
}

export async function importRawData(body: {
  temp_path: string;
  parts: string[];
  version: string;
  timestamp: string;
}): Promise<ApiResponse<{ path: string; filename: string }>> {
  return await request("/import_raw_data", { method: "POST", body: JSON.stringify(body) });
}

export async function queueDataRaw(): Promise<ApiResponse<DisturbanceDirNode>> {
  return await request<DisturbanceDirNode>("/queue_data_raw");
}

export async function processToSim(body: {
  file_path: string;
  method?: string;
}): Promise<ApiResponse<{ path: string; filename: string }>> {
  return await request("/process_to_sim", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchSummaryCsvOptions(): Promise<ApiResponse<SummaryCsvOptions>> {
  return await request<SummaryCsvOptions>("/summary_csv_options");
}

export async function deleteDataFiles(
  filePaths: string[],
): Promise<ApiResponse<{ deleted: string[]; errors: string[] }>> {
  return await request("/delete_data_files", {
    method: "POST",
    body: JSON.stringify({ file_paths: filePaths }),
  });
}

// ── Sweep ──

export async function addSweep(
  body: SweepRequest,
): Promise<ApiResponse<{ id: number }>> {
  return await request<{ id: number }>("/add_sweep", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateSweep(
  id: number,
  body: SweepRequest,
): Promise<ApiResponse> {
  return await request(`/update_sweep/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteSweep(id: number): Promise<ApiResponse> {
  return await request(`/delete_sweep/${id}`, { method: "DELETE" });
}

export async function batchSweeps(
  ids: number[],
): Promise<ApiResponse<SweepModel[]>> {
  return await request<SweepModel[]>(
    `/batch_sweeps?ids=${ids.join(",")}`,
  );
}

export async function sweepsByCase(
  caseId: number,
): Promise<ApiResponse<SweepModel[]>> {
  return await request<SweepModel[]>(`/sweeps_by_case/${caseId}`);
}

export async function sweepsByUser(
  user: string,
): Promise<ApiResponse<SweepModel[]>> {
  return await request<SweepModel[]>(
    `/sweeps_by_user?user=${encodeURIComponent(user)}`,
  );
}

export async function linkSweepToCase(
  caseId: number,
  sweepId: number,
): Promise<ApiResponse> {
  return await request(
    `/link_sweep?case_id=${caseId}&sweep_id=${sweepId}`,
    { method: "PUT" },
  );
}

export async function updateSharding(
  caseId: number,
  enableSharding: boolean,
): Promise<ApiResponse> {
  return await request(
    `/update_sharding?case_id=${caseId}&enable_sharding=${enableSharding}`,
    { method: "PUT" },
  );
}

export async function unlinkSweepFromCase(
  caseId: number,
  sweepId: number,
): Promise<ApiResponse> {
  return await request(
    `/unlink_sweep?case_id=${caseId}&sweep_id=${sweepId}`,
    { method: "DELETE" },
  );
}

// ── Sweep Templates ──

export async function fetchSweepTemplates(): Promise<
  ApiResponse<{ name: string; path: string }[]>
> {
  return await request("/sweep_templates");
}

export async function fetchSweepTemplate(
  path: string,
): Promise<ApiResponse<{ name: string; groups: unknown }>> {
  return await request(
    `/sweep_template?path=${encodeURIComponent(path)}`,
  );
}

export async function getWorkspaceSignals(
  workspace: string,
  signalNames: string[],
  domain: string,
  start?: number,
  end?: number,
  raw?: boolean,
): Promise<ApiResponse<{ columns: DisturbanceColumn[] }>> {
  const body: Record<string, unknown> = { signal_names: signalNames, domain };
  if (!isNil(start) && !isNil(end)) {
    body.start = start;
    body.end = end;
  }
  if (raw) {
    body.raw = true;
  }
  return await request(
    `/workspace_data/signals?workspace=${encodeURIComponent(workspace)}`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
