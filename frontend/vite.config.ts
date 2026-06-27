import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['kh.tail504583.ts.net', 'whale-arc.com', 'test.whale-arc.com'],
    proxy: {
      '/api': {
        // 기본 8080(기본 프로파일). test 백엔드를 8081로 띄워 개발하면 VITE_PROXY_TARGET=http://localhost:8081 로 지정
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
        // rewrite 제거 - 백엔드 API가 /api로 시작하므로
      },
    },
  },
})
