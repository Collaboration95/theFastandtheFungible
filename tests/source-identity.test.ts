import { describe, expect, it } from 'vitest'
import { sourceKey, citationIdentity, sourceBinding } from '../shared/source-identity.js'
import { approvedPublisherOrigin, PublisherClient } from '../server/publisher-client.js'
import { resolveCitation } from '../server/agents/citations.js'
import { exampleContent } from '../shared/contracts/examples.js'
const source = { schemaVersion: 1 as const, origin: 'http://127.0.0.1:1234', sellerKey: 'key', profileId: 'writer', resourceId: 'article', version: 'v1' }
const ref = { source, resourceId: 'article', version: 'v1' }
describe('canonical identity and endpoint adversaries', () => {
  it('distinguishes origin, key, writer, article and version without delimiter ambiguity', () => {
    for (const field of ['origin','sellerKey','profileId','resourceId','version'] as const) expect(sourceKey({ ...ref, source: { ...source, [field]: source[field] + '-other' } })).not.toBe(sourceKey(ref))
    expect(citationIdentity({ ...ref, spanId: 'a|b' })).not.toBe(citationIdentity({ ...ref, spanId: 'a' }))
    expect(sourceBinding({ ...ref, resourceId: 'wrong' })).toBe(false)
  })
  it.each(['http://localhost:1234','http://10.0.0.1','http://169.254.169.254','http://[::ffff:127.0.0.1]','http://[fe80::1]','https://public.example','http://user:pass@127.0.0.1','http://127.0.0.1?x=1','http://127.0.0.1#x','http://rebind.example'])('rejects unadmitted origin %s before network', origin => expect(() => approvedPublisherOrigin(origin)).toThrow())
  it('rejects a fourth origin and duplicates', () => {
    expect(() => new PublisherClient({ baseUrls: Array(4).fill(source.origin) }).origins()).toThrow()
    expect(() => new PublisherClient({ baseUrls: Array(2).fill(source.origin) }).origins()).toThrow()
  })
  it('refuses wrong-origin admission but preserves saved loopback recovery', () => {
    const c = new PublisherClient({ baseUrls: ['http://127.0.0.1:1235'] })
    expect(() => c.forSource(source)).toThrow(); expect(c.forSource(source,true).origin).toBe(source.origin)
    expect(() => new PublisherClient({ baseUrls: [source.origin,'http://127.0.0.1:1235'] }).forSource()).toThrow()
  })
  it.each(['https://attacker.example/x','//127.0.0.1:2/x','/\\attacker/x','/%2f%2fattacker/x'])('does not forward signature or token to %s', async path => {
    const c = new PublisherClient({ baseUrl: source.origin })
    await expect(c.paidGet(path, 'secret-signature')).rejects.toThrow()
  })
  it('never resolves a cross-origin or ambiguous legacy citation', () => {
    const a = { ...exampleContent, ...ref, profileId: 'writer' }, b = { ...a, source: { ...source, origin: 'http://127.0.0.1:1235' } }
    expect(resolveCitation({ ...ref, spanId: a.spans[0].id }, [b])).toBeUndefined()
    expect(resolveCitation({ resourceId: 'article', version: 'v1', spanId: a.spans[0].id }, [a,b])).toBeUndefined()
  })
})
it('rejects redirects without forwarding payment signature or engine bearer', async () => {
  const { createServer } = await import('node:http')
  let forwarded = 0
  const target = createServer((_req,res) => { forwarded++; res.end('{}') })
  await new Promise<void>(r => target.listen(0,'127.0.0.1',r))
  const targetUrl = `http://127.0.0.1:${(target.address() as {port:number}).port}`
  const redirect = createServer((req,res) => { expect(req.headers.authorization).toBeUndefined(); expect(req.headers['x-delivery-token']).toBeUndefined(); res.writeHead(302,{Location:targetUrl});res.end() })
  await new Promise<void>(r => redirect.listen(0,'127.0.0.1',r))
  try {
    await expect(new PublisherClient({baseUrl:`http://127.0.0.1:${(redirect.address() as {port:number}).port}`,secret:'engine-bearer'}).paidGet('/w/writer/articles/article','signed')).rejects.toThrow()
    expect(forwarded).toBe(0)
  } finally { for(const s of [redirect,target]) {s.closeAllConnections(); await new Promise<void>(r=>s.close(()=>r()))} }
})
it('follow-up exclusions retain a new signer identity at the same origin and local IDs', async()=>{
  const { followUpSearch }=await import('../server/agents/research.js')
  const { exampleCandidate }=await import('../shared/contracts/examples.js')
  const changed={...source,sellerKey:'new-key'}
  const hit={source:changed,publisherSlug:'writer',writerSlug:'writer',articleId:'article',version:'v1',title:'Article',abstract:'Abstract',tags:[],tier:'FREE' as const,priceMinor:0,url:'/w/writer/articles/article',relevance:1,family:'article',publishedAt:'2026-11-04',searchMode:'keyword' as const}
  const client={registry:async()=>[{slug:'writer',name:'Writer',kind:'independent'}],searchPublisher:async()=>[hit],readFree:async()=>({...exampleContent,...ref,source:changed,profileId:'writer',verification:{manifest:{},salts:[]}})} as unknown as PublisherClient // a read readFree already checked: signed (H9-02 keeps only signed free reads)
  const found=await followUpSearch(client,'q',[{...exampleCandidate,...ref,profileId:'writer',publisherSlug:'writer'}])
  expect(found.candidates).toHaveLength(1)
  expect(sourceKey(found.candidates[0])).toBe(sourceKey({...ref,source:changed}))
})
it('expires queued discovery without waiting for four unrelated paid requests to finish',async()=>{
  const {createServer}=await import('node:http')
  const responses:import('node:http').ServerResponse[]=[]
  let ready!:()=>void
  const occupied=new Promise<void>(resolve=>{ready=resolve})
  const server=createServer((_req,res)=>{responses.push(res);if(responses.length === 4) ready()})
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  const baseUrl=`http://127.0.0.1:${(server.address() as {port:number}).port}`
  const paid=Array.from({length:4},()=>new PublisherClient({baseUrl}).paidGet('/w/writer/articles/article',undefined))
  try {
    await occupied
    const start=performance.now()
    await expect(new PublisherClient({baseUrl,deadline:Date.now()+100}).registry()).rejects.toThrow()
    expect(performance.now()-start).toBeLessThan(500)
    expect(responses).toHaveLength(4)
  } finally {
    for(const res of responses) res.end('{}')
    await Promise.allSettled(paid)
    server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))
  }
})
