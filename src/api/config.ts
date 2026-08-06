/**
 * API 基础路径。默认 `/api/v1/sim`。
 * 需指向不同后端时，直接修改此常量即可。
 */
export const API_BASE = "/api/v1/sim";

/**
 * 仿真工作路径根目录，用于拼接任务工作路径：`${WORKSPACE_ROOT}\task_${taskId}`。
 * 需指向不同环境时，直接修改此常量即可。
 */
export const WORKSPACE_ROOT = "D:\\Project\\ROOT\\WorkSpace";

/** 由任务 id 拼接工作路径。 */
export function taskWorkspacePath(taskId: number): string {
  return `${WORKSPACE_ROOT}\\task_${taskId}`;
}

/**
 * 允许登录的用户名单。切换用户时，输入的名字必须在此名单内，否则提示无权限。
 * 按实际需要增删。
 */
export const ALLOWED_USERS = ["user1", "user2", "user3", "user4", "user5", "user6", "user7", "user8", "user9", "user10", "user11", "user12", "user13", "user14", "user15", "user16", "user17", "user18", "user19", "user20", "user21", "user22", "user23", "user24", "user25", "user26", "user27", "user28", "user29", "user30", "user31", "user32", "user33", "user34", "user35", "user36", "user37", "user38", "user39", "user40", "user41", "user42", "user43", "user44", "user45", "user46", "user47", "user48", "user49", "user50", "user51", "user52", "user53", "user54", "user55", "user56", "user57", "user58", "user59", "user60", "user61", "user62", "user63", "user64", "user65", "user66", "user67", "user68", "user69", "user70", "user71", "user72", "user73", "user74", "user75", "user76", "user77", "user78", "user79", "user80", "user81", "user82", "user83", "user84", "user85", "user86", "user87", "user88", "user89", "user90", "user91", "user92", "user93", "user94", "user95", "user96", "user97", "user98", "user99", "user100", "user101", "user102", "user103", "user104", "user105", "user106", "user107", "user108", "user109", "user110", "user111", "user112", "user113", "user114", "user115", "user116", "user117", "user118", "user119", "user120", "user121", "user122", "user123", "user124", "user125", "user126", "user127", "user128", "user129", "user130", "user131", "user132", "user133", "user134", "user135", "user136", "user137", "user138", "user139", "user140", "user141", "user142", "user143", "user144", "user145", "user146", "user147", "user148", "user149", "user150", "user151", "user152", "user153", "user154", "user155", "user156", "user157", "user158", "user159", "user160", "user161", "user162", "user163", "user164", "user165", "user166", "user167", "user168", "user169", "user170", "user171", "user172", "user173", "user174", "user175", "user176", "user177", "user178", "user179", "user180", "user181", "user182", "user183", "user184", "user185", "user186", "user187", "user188", "user189", "user190", "user191", "user192", "user193", "user194", "user195", "user196", "user197", "user198", "user199", "user200", "admin"];
