import { expect, test, vi } from 'vitest'
import { request } from 'node:http'
import { once } from 'node:events'
import { join } from 'node:path'
import { createApiApp } from '../server/routes.js'
import { RunPhaseSchema, AskSchema } from '../shared/contracts/run.js'
import openapi from '../docs/api/openapi.json' with { type: 'json' }
import { resources } from './helpers/resource-scope.js'

type Layer = { route?: { path: string | string[]; methods: Record<string, boolean> }; handle?: { stack?: Layer[] } }
const inventory = (layers: Layer[]): string[] => layers.flatMap(layer => layer.route
  ? [layer.route.path].flat().flatMap(path => Object.keys(layer.route!.methods).map(method => `${method} ${path.replace(/:([\w]+)/g, '{$1}')}`))
  : inventory(layer.handle?.stack ?? []))

test('OpenAPI inventories the real Express routes, including conditional owner/demo routes', async () => {
  vi.stubEnv('PUBLISHER_FAULTS', '1')
  const api = await createApiApp({ dbPath: join(resources().tempDir('dx-api-'), 'app.db'), publisherUrl: 'http://127.0.0.1:1' })
  resources().defer(() => api.close())
  try {
    const documented = Object.entries(openapi.paths).flatMap(([path, item]) => Object.keys(item).filter(key => ['get','post','delete','patch','put'].includes(key)).map(method => `${method} ${path}`))
    expect([...new Set(inventory(api.app.router.stack as unknown as Layer[]))].sort()).toEqual(documented.sort())
    expect(openapi.openapi).toBe('3.1.0')
    expect(openapi.components.schemas.Run.properties.phase.enum).toEqual(RunPhaseSchema.options)
    const ask = openapi.components.schemas.Ask
    expect(AskSchema.shape.question.safeParse(ask.example.question).success).toBe(true)
    expect(ask.properties.question.minLength).toBe(1)
    const server = api.app.listen(0, '127.0.0.1')
    resources().defer(() => new Promise<void>((done, fail) => { server.close(error => error ? fail(error) : done()); server.closeAllConnections() }))
    await once(server, 'listening')
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    expect(await (await fetch(`${url}/openapi.json`)).json()).toEqual(openapi)
    const badHost = await new Promise<number>(done => { const req = request(`${url}/openapi.json`, { headers: { Host: 'evil.example' } }, res => { res.resume(); done(res.statusCode!) }); req.end() })
    expect(badHost).toBe(403)
    expect((await fetch(`${url}/openapi.json`, { headers: { Origin: 'http://evil.example' } })).status).toBe(403)
  } finally { vi.unstubAllEnvs() }
})
