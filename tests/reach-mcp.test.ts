import { it, expect, vi } from 'vitest'
import { once } from 'node:events'
import { request, createServer } from 'node:http'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { PublisherClient } from '../server/publisher-client.js'
import { createApiApp } from '../server/routes.js'
import { createPublisherApp } from '../publisher/routes.js'
import { resources } from './helpers/resource-scope.js'
import { USE_CASES } from './scenarios/use-cases.js'

it('anonymous SDK ask uses web quotas, identity, receipts and pause checks; rejects hostile origins/hosts', async () => {
  const dir = resources().tempDir('reach-'), control = join(dir,'control.json')
  const pub = createPublisherApp({journal:':memory:',rail:'simulated',env:{}})
  await pub.locals.ready
  const publisher = pub.listen(0,'127.0.0.1'); await once(publisher,'listening')
  const publisherUrl = `http://127.0.0.1:${(publisher.address() as {port:number}).port}`
  const server = createServer().listen(0,'127.0.0.1'); await once(server,'listening')
  const url = `http://127.0.0.1:${(server.address() as {port:number}).port}/mcp`
  const host = new URL(url).host
  const until = '2026-11-19T16:00:00Z'
  for (const [key,value] of Object.entries({ HOSTED:'1', MCP_PUBLIC:'on', HOSTED_ORIGIN:`https://${host}`, HOSTED_TRUSTED_PROXY:'127.0.0.1', HOSTED_IP_HMAC_KEY:'a'.repeat(32), HOSTED_CONTROL_PATH:control, SETTLEMENT_RAIL:'simulated', LLM_PROVIDER:'fixture', DECISION_PROVIDER:'fixture', ANCHOR_RAIL:'off' })) vi.stubEnv(key,value)
  const pause = (paused: boolean) => writeFileSync(control,JSON.stringify({admissionsPaused:paused,spendingPaused:paused,reasonCode:'test',expiresAt:until}))
  pause(false)
  const api = await createApiApp({ dbPath: join(dir,'app.db'), publisherUrl, hostedReadiness:async()=>true })
  server.on('request',api.app)
  const wire = (headers:Record<string,string>,method='POST',body='{}') => new Promise<number>((done,fail) => { const r=request(url,{method,headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...headers}},res=>{res.resume();done(res.statusCode!)});r.on('error',fail);r.end(method==='POST'?body:undefined) })
  const clients: Client[] = []
  const connect = async (ip='198.51.100.1') => {
    const client = new Client({name:'reach-test',version:'1'}); clients.push(client)
    await client.connect(new StreamableHTTPClientTransport(new URL(url),{requestInit:{headers:{Host:host,'X-Forwarded-For':ip}}}))
    return client
  }
  try {
    expect(await wire({Host:'evil.example'})).toBe(403)
    expect(await wire({Host:host,Origin:'https://evil.example'})).toBe(403)
    expect(await wire({Host:host,'X-Forwarded-For':'1.2.3.4, 5.6.7.8'})).toBe(403)
    expect(await wire({Host:host},'GET')).toBe(405)
    expect(await wire({Host:host,'MCP-Protocol-Version':'2099-01-01'},'POST',JSON.stringify({jsonrpc:'2.0',id:99,method:'tools/list',params:{}}))).toBe(400)
    const client = await connect()
    expect((await client.listTools()).tools.map(t=>t.name).sort()).toEqual(['ask_expert','get_run','lookup_receipt','search_expertise','status','verify_answer'])
    const call = async (c:Client,name:string,args:Record<string,unknown>={}) => {
      const r=await c.callTool({name,arguments:args});expect(r.isError,JSON.stringify(r)).not.toBe(true);return JSON.parse((r.content as {text:string}[])[0].text)
    }
    const metadata = await call(client,'search_expertise',{query:'x402 pricing'})
    expect(metadata.hits.length).toBeGreaterThan(0)
    for (const hit of metadata.hits) {
      expect(new URL(hit.url).origin).toBe(`https://${host}`)
      expect(new URL(hit.url).pathname).toMatch(/^\/w\/[^/]+\/blog\//)
    }
    const page = await fetch(metadata.hits[0].url.replace('https:', 'http:'))
    expect(page.status).toBe(200)
    expect(metadata.hits.some((hit: {writerProvenance:{synthetic:boolean}}) => hit.writerProvenance.synthetic === true)).toBe(true)
    const offline = vi.spyOn(PublisherClient.prototype,'searchPublisher').mockRejectedValueOnce(new Error('writer unavailable'))
    try { expect((await call(client,'search_expertise',{query:'x402 pricing'})).unavailable).toBe(true) } finally { offline.mockRestore() }
    const args = {question:USE_CASES.UC2.question,budget_sgd:2,idempotency_key:'reach-once'}
    const run = await call(client,'ask_expert',args)
    expect(run.phase).toBe('DONE'); expect(run.purchases.length).toBeGreaterThan(0)
    expect(run.citations.length).toBeGreaterThan(0)
    expect(run.citations.every((citation: {url: string}) => new URL(citation.url).origin === `https://${host}`)).toBe(true)
    expect((await call(client,'ask_expert',args)).run_id).toBe(run.run_id)
    const reconnect = await connect()
    expect((await call(reconnect,'get_run',{run_id:run.run_id})).run_id).toBe(run.run_id)
    expect((await call(client,'lookup_receipt',{run_id:run.run_id})).receipts.length).toBeGreaterThan(0)
    expect((await call(client,'verify_answer',{run_id:run.run_id})).ok).toBe(true)
    const other = await connect('198.51.100.2')
    expect((await other.callTool({name:'get_run',arguments:{run_id:run.run_id}})).isError).toBe(true)
    expect((await call(client,'status')).remaining.questions).toBe(4)
    pause(true)
    expect((await client.callTool({name:'ask_expert',arguments:{...args,idempotency_key:'paused'}})).isError).toBe(true)
    expect(api.store.listRuns()).toHaveLength(1)
  } finally { await Promise.all(clients.map(c=>c.close()));server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await api.close();publisher.closeAllConnections();await new Promise<void>(r=>publisher.close(()=>r()));pub.locals.journal.close();vi.unstubAllEnvs() }
},60_000)
