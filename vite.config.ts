import { defineConfig } from 'vite'
import { realpathSync } from 'node:fs'
import react from '@vitejs/plugin-react'
const offset = Number(process.env.DEMO_PORT_OFFSET || 0)
const api = `http://127.0.0.1:${process.env.PORT || 8788 + offset}`
// The bundled client uses a server-side proxy; the token never enters its bundle.
const backend: import('vite').ProxyOptions = { target: api, changeOrigin: true, configure(proxy) {
  proxy.on('proxyReq', req => { if (process.env.RA_API_TOKEN) req.setHeader('Authorization', `Bearer ${process.env.RA_API_TOKEN}`) })
} }
const proxy = { '/runs': backend, '/api': backend, '/w': process.env.PUBLISHER_URL || `http://127.0.0.1:${process.env.PUBLISHER_PORT || 8790 + offset}` }
const clientHosts = (process.env.RA_ALLOWED_HOSTS ?? '').split(',').map(s => s.trim()).filter(Boolean)
if (process.env.RA_WEB_ORIGIN) clientHosts.push(new URL(process.env.RA_WEB_ORIGIN).hostname)
const clientAuthority: import('vite').Connect.NextHandleFunction = (req, res, next) => {
  const host = req.headers.host?.replace(/:\d+$/, '')
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(host ?? '')
  const localSocket = ['127.0.0.1', '::1'].includes(req.socket.remoteAddress?.replace(/^::ffff:/, '') ?? '')
  const optedIn = process.env.RA_CLIENT_LAN === '1'
  const origin = req.headers.origin
  const ownOrigin = `http://${req.headers.host}`
  if ((!optedIn && !localSocket) || (!local && !(optedIn && clientHosts.includes(host ?? ''))) || (origin && origin !== ownOrigin && origin !== process.env.RA_WEB_ORIGIN)) {
    res.statusCode = 403; res.end('Forbidden'); return
  }
  next()
}
export default defineConfig({
  plugins: [react(), {
    name: 'local-client-authority',
    configureServer(server) { server.middlewares.use(clientAuthority) },
    configurePreviewServer(server) { server.middlewares.use(clientAuthority) },
  }, {
    name: 'private-preview-paths',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = new URL(req.url ?? '/', 'http://localhost').pathname
        if (/^\/(?:data|scratch|\.playwright|\.git|\.lane-a|clips)(?:\/|$)|^\/\.env/.test(path)) { res.statusCode = 403; res.end('Forbidden'); return }
        next()
      })
    },
  }],
  build: { manifest: true, rollupOptions: { input: { app: 'index.html', cast: 'design/cast/qa.html' }, output: { onlyExplicitManualChunks: true, manualChunks: id => id.endsWith('/components/CommandPalette.tsx') ? 'command-palette' : undefined } } },
  server: {
    allowedHosts: clientHosts,
    host: process.env.RA_CLIENT_LAN === '1' ? '0.0.0.0' : '127.0.0.1',
    port: 5100 + offset,
    fs: { allow: ['.', realpathSync('node_modules')], deny: ['.env', '.env.*', '**/data/**', '**/scratch/**', '**/.playwright/**', '**/.git/**', '**/.lane-a/**', '**/clips/**'] },
    proxy,
  },
  preview: { host: '127.0.0.1', allowedHosts: clientHosts, proxy },
})
