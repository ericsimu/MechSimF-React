/**
 * API 基础路径。
 *
 * 独立运行时默认 `/api/v1/sim`（Vite dev proxy → localhost:8000）。
 *
 * 嵌入父级项目、后端地址不同时，在父级项目 .env 中设置：
 *   VITE_API_BASE=http://mechsim-backend:8000/api/v1/sim
 */
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? "/api/v1/sim";
