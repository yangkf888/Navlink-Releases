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
                target: 'http://127.0.0.1:3001',
                changeOrigin: true,
                secure: false,
                ws: true
            },
            '/uploads': {
                target: 'http://127.0.0.1:3001',
                changeOrigin: true,
                secure: false
            },
            // 关键：代理所有/apps请求到Gateway
            // 这样iframe的src="/apps/docker/"会被代理，避免跨端口问题
            // 仅VPS插件需要代理（因为它是独立iframe加载）
            // Docker和Sub插件已集成到主应用，需由前端路由处理，不可代理到后端
            '/apps/vps': {
                target: 'http://127.0.0.1:3001',
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
