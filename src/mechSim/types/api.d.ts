// ── Base / Common ──

export interface BaseModel {
  id?: number;
  create_time: string;
  update_time: string;
  is_deleted: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

// ── Case ──

export interface CaseModel extends BaseModel {
  name: string;
  description: string;
  create_by: string;
  sys_name: string;
  model_name: string;
  model_verison: string;
  model_productivity: string;
  model_param: string;
  disturbance: string;
}

export interface AddCaseRequest {
  name: string;
  description: string;
  create_by: string;
  sys_name: string;
  model_name: string;
  model_verison: string;
  model_productivity: string;
  model_param: string;
  disturbance: string;
  sim_time?: number;
  sim_step?: number;
}

export type UpdateCaseRequest = AddCaseRequest;

// ── Task ──

export interface SimTask extends BaseModel {
  name: string;
  case_id: number;
  status: string;
  result: string;
  error: string;
  model_version: string;
  model_productivity: string;
  sys_name: string;
  model_name: string;
  param_diff: string;
  disturbance: string;
  sim_time: number | null;
  sim_step: number | null;
}

// ── Share ──

export interface CaseShare extends BaseModel {
  case_id: number;
  shared_to_user: string;
}

// ── Disturbance ──

export interface DisturbanceColumn {
  name: string;
  data: (number | null)[];
}

export interface DisturbanceInfo {
  columns: DisturbanceColumn[];
}

// ── Model Info ──

export interface SystemModelInfo {
  variables?: Record<string, unknown>;
  [key: string]: unknown;
}

export type ModelInfoMap = Record<string, SystemModelInfo>;

// ── Disturbance Tree ──

export interface DisturbanceFile {
  name: string;
  path: string;
}

export interface DisturbanceDirNode {
  dirs?: Record<string, DisturbanceDirNode>;
  files?: DisturbanceFile[];
}
