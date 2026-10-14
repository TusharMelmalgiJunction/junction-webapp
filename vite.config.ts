import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
// @ts-expect-error plain JS module shared with the nginx config generator
import { securityHeaders } from './deploy/securityHeaders.js'

// A production bundle must call the real HTTPS API. Without VITE_API_BASE_URL the app
// falls back to http://localhost:3000, so refuse to build rather than ship that.
// Note: .env.local applies to every mode, including build.
function requireProductionApi(mode: string): Plugin {
  return {
    name: 'junction-require-production-api',
    buildStart() {
      if (mode !== 'production') return
      const env = loadEnv(mode, process.cwd(), 'VITE_')
      const api = env.VITE_API_BASE_URL
      if (!api) throw new Error('VITE_API_BASE_URL is not set for this production build (see .env.production).')
      if (!api.startsWith('https://')) throw new Error(`VITE_API_BASE_URL must be https for a production build (got ${api}).`)
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), requireProductionApi(mode)],
  server: {
    port: 5174,
    strictPort: true,
    // Local development against production without needing CORS for localhost: the browser
    // calls /prod-api/... on this dev server and Vite forwards it to the API server-side.
    // (.env.development sets VITE_API_BASE_URL=/prod-api; builds use .env.production.)
    proxy: {
      '/prod-api': {
        // DEV_API_PROXY_TARGET (not exposed to the bundle) points the proxy elsewhere, e.g. a local API.
        target: process.env.DEV_API_PROXY_TARGET || 'https://api.junctionverse.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/prod-api/, ''),
      },
    },
  },
  // Same headers as production (minus HSTS), so `npm run preview` shows CSP problems early.
  preview: {
    port: 4174,
    headers: securityHeaders({ hsts: false }),
  },
}))
