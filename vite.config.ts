import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5100, fs: { deny: ['.env', '.env.*', 'data/mock-articles.json'] }, proxy: { '/api': 'http://localhost:8788' } },
})
