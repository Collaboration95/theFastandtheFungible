import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
const offset = Number(process.env.DEMO_PORT_OFFSET || 0) // see scripts/demo.mjs
const api = `http://127.0.0.1:${8788 + offset}`
export default defineConfig({ plugins: [react()], server: {
  port: 5100 + offset, fs: { deny: ['.env', '.env.*', '**/data/**', '**/.playwright/**', '**/.git/**'] },
  proxy: { '/runs': api, '/api': api, '/w': `http://127.0.0.1:${8790 + offset}` },
} })
