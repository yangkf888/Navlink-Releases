import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: '/',
    plugins: [
        react()
    ],
    resolve: {
        alias: {
            // 预留别名配置
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    server: {
        host: '127.0.0.1',
        port: 5176,
        strictPort: false,
        proxy: {
            // 代理所有 API 请求到后端服务
            '/api': {
                target: 'http://localhost:3100',
                changeOrigin: true,
                secure: false,
                ws: true
            }
        },
    },
});
