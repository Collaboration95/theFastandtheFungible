import { resources } from './helpers/resource-scope.js'
import { afterEach, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import { statSync, writeFileSync, readFileSync, chmodSync } from 'node:fs'
import { Wallet, decode } from 'xrpl'
import { PublisherJournal } from '../publisher/journal.js'
import { XrplPayer } from '../server/xrpl.js'
import { chain } from './fixtures/key-reveal-ledger.js'
import { loadConfig } from '../server/config.js'
import { applyOwnerConfig } from '../server/owner-config.js'
import { escrowAsset } from '../server/escrow-asset.js'
import { Reputation } from '../server/reputation.js'
import { Store } from '../server/store.js'
import { createApiApp } from '../server/routes.js'
import { createPublisherApp } from '../publisher/routes.js'
import { PublisherClient } from '../server/publisher-client.js'
import { createServer } from 'node:http'
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })
it('A04 serializes different signer objects for one wallet across anchor/create/cancel', async () => {
  const c=chain(), w=Wallet.generate(), signers=Array.from({length:3},()=>new XrplPayer(c.ledger,w,{timeoutMs:20,pollMs:1}))
  const txs=[{TransactionType:'AccountSet'},{TransactionType:'EscrowCreate',Destination:Wallet.generate().classicAddress,Amount:'1000',CancelAfter:800000120,FinishAfter:800000001},{TransactionType:'EscrowCancel',Owner:w.classicAddress,OfferSequence:8}]
  const signed=await Promise.all(signers.map((s,i)=>s.escrow(txs[i] as Parameters<XrplPayer['escrow']>[0],0,x=>x,x=>c.ledger.request({command:'submit',tx_blob:x.txBlob}))))
  await Promise.all(signed.map(s=>s.sent))
  expect(new Set(signed.map(s=>decode(s.submission.txBlob).Sequence)).size).toBe(3)
})
it('A04 never overwrites a persisted finish on a stale retry', () => {
  const j=resources().own(new PublisherJournal(':memory:')), finish={txHash:'A'.repeat(64),txBlob:'first',lastLedgerSequence:20}
  j.saveKeyReveal('invoice',{secret:'synthetic',finish})
  j.saveKeyReveal('invoice',{secret:'synthetic',finish:{...finish,txHash:'B'.repeat(64)}})
  expect(j.keyReveal('invoice')!.finish).toEqual(finish)
})
it('A15 creates and reopens private publisher journal files under umask 022', () => {
  const dir=join(resources().tempDir('hm-private-'),'private'), path=join(dir,'publisher.db'), mask=process.umask(0o022)
  try {
    const j=new PublisherJournal(path)
    try { for(const f of [path,path+'-wal',path+'-shm']) expect(statSync(f).mode & 0o777).toBe(0o600); expect(statSync(dir).mode & 0o777).toBe(0o700) } finally {j.close()}
    chmodSync(dir,0o755);chmodSync(path,0o644)
    const reopened=new PublisherJournal(path)
    try { expect(statSync(path).mode & 0o777).toBe(0o600); expect(statSync(dir).mode & 0o777).toBe(0o700) } finally {reopened.close()}
  } finally {process.umask(mask)}
})
it.each(['SETTLEMENT_RAIL','ANCHOR_RAIL','LLM_PROVIDER','DECISION_PROVIDER','SEARCH_EMBEDDINGS','ESCROW_MODE','ESCROW_ASSET'])('A19 rejects typos in %s', name => {
  expect(()=>loadConfig({[name]:'typo-sensitive-value'})).toThrow(`Invalid configuration: ${name}`)
})
it('A11 owner TEST-SGD persists the canonical asset and survives restart',()=>{
  const dir=resources().tempDir('hm-owner-'), issuer=Wallet.generate().classicAddress
  writeFileSync(join(dir,'owner-settings.json'),JSON.stringify({ESCROW_ASSET:'TEST-SGD',ESCROW_MODE:'key-reveal'}))
  const env={RA_DATA_DIR:dir,TESTNET_IOU_ISSUER:issuer} as NodeJS.ProcessEnv
  applyOwnerConfig(env)
  expect(env.ESCROW_ASSET).toBe('test-iou')
  vi.stubEnv('ESCROW_ASSET',env.ESCROW_ASSET); vi.stubEnv('TESTNET_IOU_ISSUER',issuer)
  expect(escrowAsset()).toMatchObject({currency:'SGT',issuer})
})
it.each(['putReputation','appendEvent','updateRun'] as const)('A14 rolls reputation and deduplication back together at interrupted %s',boundary=>{
  const s=resources().own(new Store(':memory:')), r=s.createRun('SYNTHETIC',200), rep=new Reputation(s), wallet=Wallet.generate().classicAddress
  const input={publisherSlug:'fixture',wallet,outcome:'REJECTED' as const,runId:r.runId,claimed:0.9,intentId:'failed-proof'}
  const spy=vi.spyOn(s,boundary).mockImplementationOnce(()=>{throw Error('synthetic crash')})
  expect(()=>rep.recordProof(input)).toThrow('synthetic crash'); spy.mockRestore()
  expect(s.getReputation(wallet)).toBeUndefined()
  rep.recordProof(input); rep.recordProof(input)
  expect(s.getReputation(wallet)).toMatchObject({fails:1,n:1})
})
it.each(['api','publisher'])('A18 returns safe 400/413 envelopes from %s',async kind=>{
  const dir=resources().tempDir('hm-parser-')
  const api=kind==='api'?await createApiApp({dbPath:join(dir,'app.db'),reconcileIntervalMs:0}):undefined
  const app=api?.app ?? createPublisherApp({journal:join(dir,'publisher.db')})
  const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r))
  try {
    const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`
    for(const [body,status] of [['{',400],[JSON.stringify({text:'x'.repeat(9*1024*1024)}),413]] as const){
      const response=await fetch(base+'/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body})
      expect(response.status).toBe(status); expect(await response.json()).toMatchObject({code:'invalid',status,retryable:false})
    }
  } finally {server.closeAllConnections(); await new Promise<void>(r=>server.close(()=>r())); await api?.close(); app.locals.journal?.close()}
})
it('A10 allows a 2.1 second search before the embedding fallback deadline',async()=>{
  const server=createServer((req,res)=>{if(req.url==='/registry')res.end(JSON.stringify({publishers:[]}));else setTimeout(()=>res.end('[]'),2100)})
  server.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r))
  try {const c=new PublisherClient({baseUrl:`http://127.0.0.1:${(server.address() as {port:number}).port}`}).origins()[0]; await expect(c.searchPublisher('fixture','q',5,3000)).resolves.toEqual([])}
  finally {server.closeAllConnections(); await new Promise<void>(r=>server.close(()=>r()))}
})
it('A20 pins a fixed AJV release',()=>{
  expect(JSON.parse(readFileSync('package.json','utf8')).devDependencies.ajv).toBe('8.20.0')
})

it('A10 Stop cancels queued and active retrieval and releases the four slots',async()=>{
  let active=0,peak=0
  const server=createServer((req,res)=>{active++;peak=Math.max(peak,active);res.on('close',()=>active--);if(req.url?.includes('next'))res.end('[]')})
  server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r))
  const controller=new AbortController(),baseUrl=`http://127.0.0.1:${(server.address() as {port:number}).port}`
  try {
    const client=new PublisherClient({baseUrl}).withSignal(controller.signal)
    const jobs=Array.from({length:8},()=>client.searchPublisher('fixture','blocked',5,10000))
    await new Promise(r=>setTimeout(r,50)); controller.abort()
    await Promise.allSettled(jobs)
    await expect(new PublisherClient({baseUrl}).searchPublisher('fixture','next',5,500)).resolves.toEqual([])
    expect(peak).toBeLessThanOrEqual(4)
  } finally {server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))}
})

it('A19 normalizes explicit modes while retaining deliberate empty values',()=>{
 expect(loadConfig({SETTLEMENT_RAIL:' XRPL-Testnet ',LLM_PROVIDER:' DeepSeek ',DECISION_PROVIDER:'OPENAI',ESCROW_ASSET:'TEST-SGD',ANCHOR_RAIL:''})).toMatchObject({SETTLEMENT_RAIL:'xrpl-testnet',LLM_PROVIDER:'deepseek',DECISION_PROVIDER:'openai',ESCROW_ASSET:'test-iou',ANCHOR_RAIL:''})
})
it('A14 final refusal applies only its delta after broken-proof quarantine',()=>{
 const s=resources().own(new Store(':memory:')),run=s.createRun('SYNTHETIC',200),rep=new Reputation(s),wallet=Wallet.generate().classicAddress
 const input={intentId:'delta',runId:run.runId,wallet,publisherSlug:'fixture',claimed:0.9}
 rep.recordProof({...input,outcome:'REJECTED'});rep.recordProof({...input,outcome:'REFUSED'});rep.recordProof({...input,outcome:'REFUSED'})
 expect(s.getReputation(wallet)).toMatchObject({fails:1,n:1,refusals:1,status:'delisted',s:10})
})
