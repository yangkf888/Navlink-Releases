import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: './',
    plugins: [
        react(),
        // 注入base标签到HTML - 使用 plugin-content 路径
        {
            name: 'inject-base-tag',
            transformIndexHtml(html) {
                return html.replace(
                    '<head>',
                    '<head>\n    <base href="/plugin-content/video/" />'
                );
            }
        }
    ],
    resolve: {
        alias: {
            // Remove @ alias to avoid loading main app components
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
            // 代理所有 API 请求到主应用 Gateway
            '/api': {
                target: 'http://localhost:3002',
                changeOrigin: true,
                secure: false,
                ws: true
            }
        },
    },
});
