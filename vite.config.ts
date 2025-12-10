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
            // 插件内容代理 - 插件前端通过 iframe 加载
            '/plugin-content': {
                target: 'http://127.0.0.1:3002',
                changeOrigin: true,
                secure: false,
                ws: true
            },
            '/uploads': {
                target: 'http://127.0.0.1:3002',
                changeOrigin: true,
                secure: false
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
    // 生产环境移除 console 和 debugger
    esbuild: {
        drop: ['console', 'debugger'],
    },
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
            },
            output: {
                // 🚀 性能优化: 智能分包
                manualChunks: {
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'ui-libs': ['lucide-react', 'framer-motion', '@hello-pangea/dnd'],
                    'utils-libs': ['axios', 'date-fns', 'clsx', 'tailwind-merge'],
                }
            }
        },
    },
});
