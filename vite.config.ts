import { HOSTED_APP_URL } from './shared/links'
import { defineConfig } from 'vite'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
const offset = Number(process.env.DEMO_PORT_OFFSET || 0)
const api = `http://127.0.0.1:${process.env.PORT || 8788 + offset}`
// The bundled client uses a server-side proxy; the token never enters its bundle.
const backend: import('vite').ProxyOptions = { target: api, changeOrigin: true, configure(proxy) {
  proxy.on('proxyReq', req => { if (process.env.RA_API_TOKEN) req.setHeader('Authorization', `Bearer ${process.env.RA_API_TOKEN}`) })
} }
const proxy = { '/runs': backend, '/api': backend, '/proof': backend, '/w': process.env.PUBLISHER_URL || `http://127.0.0.1:${process.env.PUBLISHER_PORT || 8790 + offset}` }
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
// The in-browser receipt verifier (lazy chunk) runs sdk/verify.ts; these two Node imports get browser stand-ins.
// Nothing else in the app imports them.
const shim = (file: string) => fileURLToPath(new URL(`./src/verify/shims/${file}`, import.meta.url))
export default defineConfig({
  resolve: { alias: [{ find: /^node:crypto$/, replacement: shim('node-crypto.ts') }, { find: /^ws$/, replacement: shim('ws.ts') }] },
  plugins: [react(), {
    name: 'app-origin-meta',
    transformIndexHtml(html) { const origin=(process.env.HOSTED_ORIGIN || HOSTED_APP_URL).replace(/\/$/, ''); return html.replace(/(<meta property="og:url" content=")[^"]+/, `$1${origin}/`).replace(/(<meta (?:property="og:image"|name="twitter:image") content=")[^"]+/g, `$1${origin}/brand/og.png`) },
  }, {
    name: 'local-client-authority',
    configureServer(server) { server.middlewares.use(clientAuthority) },
    configurePreviewServer(server) { server.middlewares.use(clientAuthority) },
  }, {
    // Dev only: the built app serves the receipt verifier at /verify/proof-verify.js for the /proof/:id pages (lane W1).
    name: 'proof-verify-dev-alias',
    configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url === '/verify/proof-verify.js') req.url = '/src/verify/proof-entry.ts'; next() }) },
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
  build: { manifest: true, rollupOptions: { input: { app: 'index.html', 'proof-verify': 'src/verify/proof-entry.ts' }, preserveEntrySignatures: 'exports-only', output: {
    onlyExplicitManualChunks: true, manualChunks: id => id.endsWith('/components/CommandPalette.tsx') ? 'command-palette' : undefined,
    // The proof pages (/proof/:id, lane W1) load the receipt verifier from one stable URL, not under /assets/ (which the
    // hosted front caches as immutable). Everything else keeps its hashed name.
    entryFileNames: chunk => chunk.name === 'proof-verify' ? 'verify/proof-verify.js' : 'assets/[name]-[hash].js',
  } } },
  server: {
    allowedHosts: clientHosts,
    host: process.env.RA_CLIENT_LAN === '1' ? '0.0.0.0' : '127.0.0.1',
    port: 5100 + offset,
    fs: { allow: ['.', realpathSync('node_modules')], deny: ['.env', '.env.*', '**/data/**', '**/scratch/**', '**/.playwright/**', '**/.git/**', '**/.lane-a/**', '**/clips/**'] },
    proxy,
  },
  preview: { host: '127.0.0.1', allowedHosts: clientHosts, proxy },
})
