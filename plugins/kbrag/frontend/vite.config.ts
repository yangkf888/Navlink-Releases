import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: './',
    plugins: [
        react(),
        {
            name: 'inject-base-tag',
            transformIndexHtml(html) {
                return html.replace(
                    '<head>',
                    '<head>\n    <base href="/plugin-content/kbrag/" />'
                );
            }
        }
    ],
    resolve: {
        alias: {},
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    server: {
        port: 5176,
        proxy: {
            '/api/plugins/kbrag': {
                target: 'http://localhost:3002',
                changeOrigin: true,
            },
        },
    },
});
