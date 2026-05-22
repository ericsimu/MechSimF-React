import type {
  ApiResponse, CaseModel, SimTask, AddCaseRequest, UpdateCaseRequest,
  CaseShare, DisturbanceInfo, ModelInfoMap, DisturbanceDirNode,
} from '../types/api'

const BASE = '/api/v1/sim'

export function getCurrentUser(): string {
  return localStorage.getItem('current_user') || 'yahang.yao'
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

export function addTasks(caseId: number): Promise<ApiResponse<{ task_ids: number[] }>> {
  return request('/add_tasks', { method: 'POST', body: JSON.stringify({ case_id: caseId }) })
}

export function queueTasks(): Promise<ApiResponse<SimTask[]>> {
  return request<SimTask[]>('/queue_tasks')
}

export function runTasks(taskIds: number[]): Promise<ApiResponse<{ submitted: number[] }>> {
  return request('/run_tasks', { method: 'POST', body: JSON.stringify({ task_ids: taskIds }) })
}
