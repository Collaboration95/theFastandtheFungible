import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
const offset = Number(process.env.DEMO_PORT_OFFSET || 0) // see scripts/demo.mjs
const api = `http://127.0.0.1:${process.env.PORT || 8788 + offset}`
export default defineConfig({ plugins: [react(), { name: 'private-preview-paths', configurePreviewServer(server) { server.middlewares.use((req, res, next) => { const path = new URL(req.url ?? '/', 'http://localhost').pathname; if (/^\/(?:data|\.playwright|\.git)(?:\/|$)|^\/\.env/.test(path)) { res.statusCode = 403; res.end('Forbidden'); return } next() }) } }], server: {
  port: 5100 + offset, fs: { deny: ['.env', '.env.*', '**/data/**', '**/.playwright/**', '**/.git/**'] },
  proxy: { '/runs': api, '/api': api, '/w': process.env.PUBLISHER_URL || `http://127.0.0.1:${process.env.PUBLISHER_PORT || 8790 + offset}` },
}, preview: { proxy: { '/runs': api, '/api': api, '/w': process.env.PUBLISHER_URL || `http://127.0.0.1:${process.env.PUBLISHER_PORT || 8790 + offset}` } } })
