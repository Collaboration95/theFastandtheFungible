import { afterEach, expect, it, vi } from 'vitest'
import { once } from 'node:events'
import { createPublisherApp } from '../publisher/routes.js'
import { PublisherClient } from '../server/publisher-client.js'
import * as credentials from '../server/writer-credentials.js'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })
it.each(['valid', 'wallet', 'signature', 'slug', 'missing'])('catalogue requires a signed wallet binding: %s', async mode => {
  const app = createPublisherApp({journal:':memory:',rail:'simulated',env:{}})
  await app.locals.writersReady
  const server = app.listen(0,'127.0.0.1'); await once(server,'listening')
  const original = globalThis.fetch
  const check = vi.spyOn(credentials,'writerVerification').mockResolvedValue({status:'check_pending'})
  const paths: string[] = []
  vi.spyOn(globalThis,'fetch').mockImplementation(async (url,init) => {
    paths.push(new URL(String(url)).pathname)
    const response = await original(url,init)
    if (!String(url).includes('/.well-known/')) return response
    const card = await response.json()
    if (mode==='wallet') card.identityManifest.wallet='rNtb7gEMUHyPUR6B39HQLkEhUtrYtY7NNf'
    if (mode==='signature') card.identityManifest.sig='00'
    if (mode==='slug') card.identityManifest.publisherSlug='other-writer'
    if (mode==='missing') delete card.identityManifest
    expect(JSON.stringify(card)).not.toMatch(/"body"|"passages"|"privateKey"|"seed"/)
    return new Response(JSON.stringify(card))
  })
  try {
    const client = new PublisherClient({baseUrl:`http://127.0.0.1:${(server.address() as {port:number}).port}`})
    const catalogue = await client.writerCatalogue()
    const team = catalogue.filter(p=>p.authorship==='team-authored')
    expect(team).toHaveLength(3)
    expect(team.every(p=>p.verification?.status===(mode==='valid'?'check_pending':'check_failed'))).toBe(true)
    expect(check).toHaveBeenCalledTimes(mode==='valid'?3:0)
    expect(catalogue.filter(p=>p.authorship!=='team-authored').every(p=>p.verification?.status==='unverified')).toBe(true)
    expect(paths).toHaveLength(4)
    expect(paths.every(p=>p==='/registry'||p.endsWith('/.well-known/agent-publisher.json'))).toBe(true)
  } finally { server.closeAllConnections(); await new Promise<void>(r=>server.close(()=>r())); app.locals.journal.close() }
})
