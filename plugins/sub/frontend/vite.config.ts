import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: './',
    plugins: [
        react(),
        // 注入base标签到HTML,确保相对路径正确解析
        {
            name: 'inject-base-tag',
            transformIndexHtml(html) {
                return html.replace(
                    '<head>',
                    '<head>\n    <base href="/apps/sub/" />'
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
        port: 5175,
        proxy: {
            '/api/apps/sub/api': {
                target: 'http://localhost:8082/api',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/apps\/sub\/api/, ''),
            },
        },
    },
});
