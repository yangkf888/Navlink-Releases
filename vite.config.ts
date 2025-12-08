import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: '127.0.0.1', // 强制使用IPv4
        port: 5173, // 使用标准端口，与后端 CORS 配置一致
        strictPort: true, // 如果端口被占用则报错而不是自动切换
        proxy: {
            // 所有API请求代理到Gateway
            '/api': {
                target: 'http://127.0.0.1:3002',
                changeOrigin: true,
                secure: false,
                ws: true
            },
            '/uploads': {
                target: 'http://127.0.0.1:3002',
                changeOrigin: true,
                secure: false
            },
            // 仅VPS插件使用iframe架构（独立Go应用）
            '/apps/vps': {
                target: 'http://127.0.0.1:3002',
                changeOrigin: true,
                secure: false,
                ws: true,
            }
        },
        watch: {
            ignored: ['**/data/**', '**/logs/**']
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                // Future plugins will be added here, e.g.:
                // vps: path.resolve(__dirname, 'plugins/vps/frontend/index.html'),
            },
        },
    },
});
