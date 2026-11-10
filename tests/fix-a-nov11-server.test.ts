// FIX-A (sweep 11 Nov), server side: the local app answers the status route, and the writers API names the publication.
import { expect, it } from 'vitest'
import { once } from 'node:events'
import { createApiApp } from '../server/routes'

async function withApp<T>(run: (base: string) => Promise<T>): Promise<T> {
  const api = await createApiApp({ dbPath: ':memory:' })
  const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
  try { return await run(`http://127.0.0.1:${(server.address() as { port: number }).port}`) } finally { server.close(); await api.close() }
}

it('S15: a local server answers 200 {hosted:false} at /api/demo/status, so the browser console stays clean', async () => {
  await withApp(async base => {
    const response = await fetch(`${base}/api/demo/status`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ hosted: false })
  })
})

it('S9: the writers API names the publication beside the byline', async () => {
  await withApp(async base => {
    const body = await (await fetch(`${base}/api/writers/earnings`)).json() as { writers: { name: string; publisher: string; publisherSlug: string }[] }
    expect(body.writers.length).toBeGreaterThan(0)
    expect(body.writers.find(item => item.name === 'Priya Nair')?.publisher).toBe('NotFinancialTimes')
    expect(body.writers.every(item => item.publisher && item.publisherSlug)).toBe(true)
  })
})
