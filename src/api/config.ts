/**
 * API 基础路径。默认 `/api/v1/sim`。
 * 需指向不同后端时，直接修改此常量即可。
 */
export const API_BASE = "/api/v1/sim";

/**
 * 仿真工作路径根目录，用于拼接任务工作路径：`${WORKSPACE_ROOT}\task_${taskId}`。
 * 需指向不同环境时，直接修改此常量即可。
 */
export const WORKSPACE_ROOT = "C:\\dsong_work\\my_projects\\yls\\a02_implements\\p07_MechSimReact\\Project\\ROOT\\WorkSpace";

/** 由任务 id 拼接工作路径。 */
export function taskWorkspacePath(taskId: number): string {
  return `${WORKSPACE_ROOT}\\task_${taskId}`;
}

/**
 * 允许登录的用户名单。切换用户时，输入的名字必须在此名单内，否则提示无权限。
 * 按实际需要增删。
 */
export const ALLOWED_USERS = ["user1", "user2", "admin"];
