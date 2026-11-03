import { afterEach, expect, it, vi } from 'vitest'
import { createServer as createHttpServer, request } from 'node:http'
import { once } from 'node:events'
import { createServer } from 'vite'
import { resolve } from 'node:path'

const cleanup: (() => unknown)[] = []
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); vi.unstubAllEnvs() })

it('bundled dev proxy checks Host and Origin before supplying its server-only token', async () => {
  const calls: string[] = []
  const backend = createHttpServer((req, res) => { calls.push(req.headers.authorization ?? ''); res.end('{}') })
  backend.listen(0, '127.0.0.1'); await once(backend, 'listening')
  cleanup.push(() => new Promise<void>(done => { backend.closeAllConnections(); backend.close(() => done()) }))
  vi.stubEnv('PORT', String((backend.address() as { port: number }).port))
  vi.stubEnv('RA_API_TOKEN', 'private-proxy-token')
  vi.stubEnv('RA_CLIENT_LAN', '0')
  vi.stubEnv('RA_WEB_ORIGIN', 'http://127.0.0.1:6200')
  const vite = await createServer({ configFile: resolve('vite.config.ts'), server: { port: 0, strictPort: false }, logLevel: 'silent' })
  cleanup.push(() => vite.close()); await vite.listen()
  const port = (vite.httpServer!.address() as { port: number }).port
  const wire = (headers: Record<string, string> = {}) => new Promise<number>((done, fail) => {
    const req = request({ hostname: '127.0.0.1', port, path: '/api/reputation/reset', method: 'POST', headers }, res => {
      res.resume(); res.on('end', () => done(res.statusCode!))
    }); req.on('error', fail); req.end()
  })
  expect(await wire({ Host: 'evil.example' })).toBe(403)
  expect(await wire({ Host: `127.0.0.1:${port}`, Origin: 'http://evil.example' })).toBe(403)
  expect(calls).toHaveLength(0)
  expect(await wire({ Host: `127.0.0.1:${port}`, Origin: 'http://127.0.0.1:6200' })).toBe(200)
  expect(calls).toEqual(['Bearer private-proxy-token'])
  // Vite's filesystem denylist must continue to hide credentials.
  expect((await fetch(`http://127.0.0.1:${port}/@fs/${resolve('.env')}`)).status).toBe(403)
})
