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
} from "../types/api";
import { isNil } from "../utils/isNil";
import { getCurrentUser } from "../utils/user";
import { API_BASE } from "./config";

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

export async function getTaskSignals(
  taskId: number,
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
  return await request(`/task_data/${taskId}/signals`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
