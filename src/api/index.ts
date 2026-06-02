import type {
  ApiResponse, CaseModel, SimTask, AddCaseRequest, UpdateCaseRequest,
  CaseShare, DisturbanceInfo, ModelInfoMap, DisturbanceDirNode, DisturbanceColumn,
} from '../types/api'

const BASE = '/api/v1/sim'

export function getCurrentUser(): string {
  return localStorage.getItem('current_user') || 'user1'
}

export function setCurrentUser(name: string): void {
  localStorage.setItem('current_user', name)
}

async function request<T = unknown>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-User': getCurrentUser(),
      ...options.headers as Record<string, string>,
    },
    ...options,
  })
  const data: ApiResponse<T> = await res.json()
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `HTTP ${res.status}: ${res.statusText}`)
  }
  return data
}

export function queueCases(): Promise<ApiResponse<CaseModel[]>> {
  return request<CaseModel[]>('/queue_cases')
}

export function addCase(body: AddCaseRequest): Promise<ApiResponse<{ id: number }>> {
  return request('/add_case', { method: 'POST', body: JSON.stringify(body) })
}

export function updateCase(id: number, body: UpdateCaseRequest): Promise<ApiResponse> {
  return request(`/update_case/${id}`, { method: 'PUT', body: JSON.stringify(body) })
}

export function deleteCase(id: number): Promise<ApiResponse> {
  return request(`/delete_case/${id}`, { method: 'DELETE' })
}

export function queueModelInfo(): Promise<ApiResponse<ModelInfoMap>> {
  return request<ModelInfoMap>('/queue_model_info', { method: 'POST' })
}

export function queueDisturbances(): Promise<ApiResponse<DisturbanceDirNode>> {
  return request<DisturbanceDirNode>('/queue_disturbances')
}

export function getDisturbanceInfo(filePath: string): Promise<ApiResponse<DisturbanceInfo>> {
  return request<DisturbanceInfo>('/get_disturbance_info', {
    method: 'POST',
    body: JSON.stringify({ file_path: filePath }),
  })
}

export function shareCase(caseId: number, sharedToUser: string): Promise<ApiResponse> {
  return request(`/share_case/${caseId}`, {
    method: 'POST',
    body: JSON.stringify({ shared_to_user: sharedToUser }),
  })
}

export function unshareCase(caseId: number, sharedToUser: string): Promise<ApiResponse> {
  return request(`/unshare_case/${caseId}`, {
    method: 'POST',
    body: JSON.stringify({ shared_to_user: sharedToUser }),
  })
}

export function getCaseShares(caseId: number): Promise<ApiResponse<CaseShare[]>> {
  return request<CaseShare[]>(`/case_shares/${caseId}`)
}

export function diffCase(id: number, body: UpdateCaseRequest): Promise<ApiResponse<Record<string, unknown>>> {
  return request(`/diff_case/${id}`, { method: 'POST', body: JSON.stringify(body) })
}

export function addTasks(caseId: number, paramDiff?: string): Promise<ApiResponse<{ task_ids: number[] }>> {
  return request('/add_tasks', { method: 'POST', body: JSON.stringify({ case_id: caseId, param_diff: paramDiff || '' }) })
}

export function queueTasks(): Promise<ApiResponse<SimTask[]>> {
  return request<SimTask[]>('/queue_tasks')
}

export function runTasks(taskIds: number[]): Promise<ApiResponse<{ submitted: number[] }>> {
  return request('/run_tasks', { method: 'POST', body: JSON.stringify({ task_ids: taskIds }) })
}

export function deleteTask(id: number): Promise<ApiResponse> {
  return request(`/delete_task/${id}`, { method: 'DELETE' })
}

export function cancelTask(id: number): Promise<ApiResponse<{ task_id: number; cancelled: boolean }>> {
  return request(`/cancel_task/${id}`, { method: 'POST' })
}

export function getTaskStatus(id: number): Promise<ApiResponse<{ task_id: number; status: string; result: unknown; error?: string }>> {
  return request(`/get_task_status/${id}`)
}

export function getTaskData(taskId: number): Promise<ApiResponse<{ columns: DisturbanceColumn[]; fft_columns?: DisturbanceColumn[]; task_status: string }>> {
  return request(`/task_data/${taskId}`)
}

export function getTaskDataColumns(taskId: number): Promise<ApiResponse<{ column_names: string[]; fft_column_names?: string[]; task_status: string }>> {
  return request(`/task_data/${taskId}?names_only=true`)
}

export function getTaskSignals(taskId: number, signalNames: string[], domain: string, start?: number, end?: number, raw?: boolean): Promise<ApiResponse<{ columns: DisturbanceColumn[] }>> {
  const body: Record<string, unknown> = { signal_names: signalNames, domain }
  if (start != null && end != null) { body.start = start; body.end = end }
  if (raw) { body.raw = true }
  return request(`/task_data/${taskId}/signals`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
