import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
  preview: {
    port: 8999,
    host: true,
    proxy: { '/api': 'http://localhost:8997' },
  },
})
