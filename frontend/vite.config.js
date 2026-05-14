import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const envLocal = loadEnv(mode, __dirname, '')
  const envParent = loadEnv(mode, path.resolve(__dirname, '..'), '')
  const target = (envLocal.VITE_API_URL || envParent.VITE_API_URL || 'http://127.0.0.1:8001').trim()

  return {
    plugins: [
      react(),
      {
        name: 'crm-api-proxy-info',
        configureServer() {
          console.info(`\n  ➜  Proxy  /api  →  ${target}\n`)
        },
      },
    ],
    server: {
      proxy: {
        '/api': { target, changeOrigin: true },
      },
    },
  }
})
