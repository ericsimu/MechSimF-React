import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 开发服务器：默认端口 5173，/api 代理到开发后端 8000
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  // 生产预览（npm run build 后 npm run preview）：端口 8999，/api 代理到生产后端 8997
  preview: {
    port: 8999,
    host: true,
    proxy: {
      '/api': 'http://localhost:8997',
    },
  },
})
