import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: './', // Important for relative paths in embedded iframe
    resolve: {
        alias: {
            '@/shared': path.resolve(__dirname, '../../../src/shared'),
            '@': path.resolve(__dirname, './src')
        }
    },
    server: {
        host: '127.0.0.1',
        port: 5174,  // 使用独立端口避免冲突
        strictPort: false,
        proxy: {
            // VPS插件的API请求代理到Gateway的插件路由
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                rewrite: (path) => `/api/apps/vps${path}`  // /api/servers -> /api/apps/vps/api/servers
            },
            // WebSocket代理
            '/ws': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                ws: true,
                rewrite: (path) => `/api/apps/vps${path}`
            }
        }
    }
})
