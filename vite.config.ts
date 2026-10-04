import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], server: {
  port: 5100, fs: { deny: ['.env', '.env.*', '**/data/**', '**/.playwright/**', '**/.git/**'] },
  proxy: { '/runs': 'http://127.0.0.1:8788', '/api': 'http://127.0.0.1:8788' },
} })
