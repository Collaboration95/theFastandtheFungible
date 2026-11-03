import { expect, it, vi } from 'vitest'
import type { Express } from 'express'
import { createApiApp } from '../server/routes.js'
import before from './fixtures/routes-before-285.json'

type Layer = { route?: { path: string | string[]; methods: Record<string, boolean> }; handle?: { stack?: Layer[] } }
function routeTable(layers: Layer[]): string[][] {
  return layers.flatMap(layer => layer.route
    ? Object.keys(layer.route.methods).flatMap(method => [layer.route!.path].flat().map(path => [method.toUpperCase(), path]))
    : routeTable(layer.handle?.stack ?? []))
}
it.each([false, true])('preserves every pre-#285 route and adds wallet controls, hire and the audit export (fault controls: %s)', async faults => {
  vi.stubEnv('PUBLISHER_FAULTS', faults ? '1' : '0')
  const api = await createApiApp({ dbPath: ':memory:' })
  try {
    const app = api.app as Express & { router: { stack: Layer[] } }
    expect(routeTable(app.router.stack).sort()).toEqual([...(faults ? before : before.filter(([, path]) => path !== '/api/demo/faults')), ['GET', '/api/health'], ['GET', '/api/metrics'], ['GET', '/api/wallet/status'], ['POST', '/api/wallet/pause'], ['POST', '/v1/ask'],
      ['GET', '/api/audit/receipts.csv'], ['GET', '/api/audit/receipts.jsonl'], ['GET', '/api/audit/verify'], ['POST', '/api/verify'], ['GET', '/runs/:id/receipts.json'], ['GET', '/runs/:id/report.json']].sort())
  } finally { await api.close(); vi.unstubAllEnvs() }
})
