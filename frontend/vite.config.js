import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Ek hi frontend, 2 pages:
//   /          -> Calculator (+ /admin)       (index.html)
//   /studio/   -> AI Design Studio            (studio/index.html)
const BACKEND = 'http://localhost:3001'

export default defineConfig({
  plugins: [
    react(),
    {
      // dev me "/studio" ko "/studio/" par bhejo
      name: 'studio-trailing-slash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/studio') {
            res.statusCode = 302
            res.setHeader('Location', '/studio/')
            return res.end()
          }
          next()
        })
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/files': { target: BACKEND, changeOrigin: true },
      '/design-images': { target: BACKEND, changeOrigin: true },
      '/generated-pdfs': { target: BACKEND, changeOrigin: true },
    },
  },
  build: {
    outDir: '../backend/public',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        studio: resolve(import.meta.dirname, 'studio/index.html'),
      },
    },
  },
})
