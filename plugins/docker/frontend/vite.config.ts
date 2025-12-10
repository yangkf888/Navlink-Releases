import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 注入base标签到HTML - 使用 plugin-content 路径
    {
      name: 'inject-base-tag',
      transformIndexHtml(html) {
        return html.replace(
          '<head>',
          '<head>\n    <base href="/plugin-content/docker/" />'
        );
      }
    }
  ],
  base: './',
  resolve: {
    alias: {
      '@/shared': path.resolve(__dirname, '../../../src/shared'),
      '@/src/shared': path.resolve(__dirname, '../../../src/shared'), // Support both alias styles
      '@': path.resolve(__dirname, './src')
    },
    dedupe: ['react', 'react-dom']
  },
  server: {
    host: '127.0.0.1',
    port: 5174, // Use a different port than VPS (5173)
    strictPort: true,
    proxy: {
      '/docker-plugin-api': {
        target: 'http://localhost:8081', // Go backend
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/docker-plugin-api/, '')
      },
      // Proxy /api to main server for ConfigProvider
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
