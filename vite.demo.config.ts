import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  root: 'demo', base: '/theFastandtheFungible/demo/', plugins: [react()],
  publicDir: false,
  build: { outDir: '../site/demo', emptyOutDir: true },
})
