// ── Base / Common ──

export interface BaseModel {
  id?: number
  create_time: string
  update_time: string
  is_deleted: boolean
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
}

// ── Case ──

export interface CaseModel extends BaseModel {
  name: string
  description: string
  create_by: string
  sys_name: string
  model_name: string
  model_verison: string
  model_productivity: string
  model_param: string
  disturbance: string
}

export interface AddCaseRequest {
  name: string
  description: string
  create_by: string
  sys_name: string
  model_name: string
  model_verison: string
  model_productivity: string
  model_param: string
  disturbance: string
}

export interface UpdateCaseRequest extends AddCaseRequest {}

// ── Task ──

export interface SimTask extends BaseModel {
  name: string
  case_id: number
  model_version: string
  workspace_path: string
  status: string
  sys_name?: string
  model_productivity?: string
  result?: unknown
}

export interface AddTasksRequest {
  case_id: number
}

export interface SimRunRequest {
  task_ids: number[]
}

export interface SimTaskStatus {
  task_id: number
  status: string
  result: unknown
  error?: string
}

// ── Share ──

export interface ShareCaseRequest {
  shared_to_user: string
}

export interface CaseShare extends BaseModel {
  case_id: number
  shared_to_user: string
}

// ── Disturbance ──

export interface DisturbanceInfoRequest {
  file_path: string
}

export interface DisturbanceColumn {
  name: string
  data: (number | null)[]
}

export interface DisturbanceInfo {
  columns: DisturbanceColumn[]
}

// ── Diff ──

export interface DiffRow {
  path: string
  old_value: unknown
  new_value: unknown
}

// ── Model Info ──

export interface SystemModelInfo {
  variables?: Record<string, unknown>
  [key: string]: unknown
}

export type ModelInfoMap = Record<string, SystemModelInfo>

// ── Disturbance Tree ──

export interface DisturbanceFile {
  name: string
  path: string
}

export interface DisturbanceDirNode {
  dirs?: Record<string, DisturbanceDirNode>
  files?: DisturbanceFile[]
}
