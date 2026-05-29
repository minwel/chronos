import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    watch: {
      // Windows 主机挂载到容器时 inotify 失效，必须用轮询才能触发 HMR
      usePolling: true,
    },
    proxy: {
      '/api': {
        // 本地 npm run dev 默认走 localhost；Docker 下经 VITE_PROXY_TARGET 指向 backend 服务
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
