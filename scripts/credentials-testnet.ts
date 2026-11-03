import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import { createPublisherApp } from '../publisher/routes.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { PublisherClient } from '../server/publisher-client.js'
/** Operator-only Testnet provisioning. Engine verifier imports no signer or submission API. */

import { Wallet, Client, type Transaction } from 'xrpl'
import { mkdirSync, writeFileSync } from 'node:fs'
import { testnetUrl } from '../shared/xrpl.js'
import { WriterCredentials, credentialRpc } from '../server/writer-credentials.js'
// Offline evidence validation must run before wallet construction or dotenv loading.
if (process.argv.includes('--check-only')) {
 const evidence = JSON.parse(readFileSync('docs/evidence/round2-n/transactions.json', 'utf8'))
 const types = new Set(evidence.transactions.map((row: { credentialTypeText: string }) => Buffer.from(row.credentialTypeText, 'utf8').toString('hex').toUpperCase()))
 if (evidence.transactions.length !== 4 || types.size !== 1) throw Error('Invalid credential evidence')
 for (const [file, key] of [['observations', 'observations'], ['engine', 'labels']]) {
  const rows = JSON.parse(readFileSync(`docs/evidence/round2-n/${file}.json`, 'utf8'))[key]
  if (rows.map((row: { verification: { status: string } }) => row.verification.status).join(',') !== 'verified,verified,unverified') throw Error('Unexpected evidence statuses')
  for (const row of rows) if (row.verification.status === 'verified' && !types.has(Buffer.from(row.verification.credentialTypeText, 'utf8').toString('hex').toUpperCase())) throw Error('Evidence type mismatch')
 }
 console.log('Offline credential evidence: four transactions, two verified writers and one unverified control; no live lookup')
 process.exit(0)
}
await import('dotenv/config')
if (!process.argv.includes('--testnet')) throw Error('Explicit --testnet required')
const seeds = Object.entries(process.env).filter(([k,v]) => /^XRPL_PUBLISHER_.*_SEED$/.test(k) && v).map(([,v]) => v!)
const issuerSeed = process.env.XRPL_PAYER_SEED ?? process.env.RLUSD_TESTNET_SEED
if (!issuerSeed || seeds.length < 3) throw Error('Existing issuer and three publisher Testnet seeds required')
const issuer = Wallet.fromSeed(issuerSeed)
const writers = [...new Map(seeds.map(s => { const w = Wallet.fromSeed(s); return [w.classicAddress,w] })).values()].filter(w => w.classicAddress !== issuer.classicAddress).slice(0,3)
if (writers.length !== 3) throw Error('Three distinct existing writers required')
const client = new Client(testnetUrl(), { connectionTimeout: 10_000, timeout: 15_000, maxFeeXRP: '0.002' })
const dir = 'docs/evidence/round2-n'
mkdirSync(dir, { recursive: true })
const transactions: Record<string,unknown>[] = []
const credentialTypeText = `ResearchAgent-writer-${new Date().toISOString().slice(0,10)}`
const credentialType = Buffer.from(credentialTypeText, 'utf8').toString('hex').toUpperCase()
const evidenceJson = (value: unknown) => JSON.stringify(value, (key, value) => key === 'credentialType' ? undefined : value, 2)
const publicObservation = (verification: Awaited<ReturnType<WriterCredentials['check']>>) => verification.status === 'verified' ? {...verification, credentialTypeText} : verification
try {
 await client.connect()
 const info = await client.request({command:'server_info'})
 if (info.result.info.network_id !== 1) throw Error('Wrong network; refusing signing')
 if (!process.argv.includes('--check-only')) for (const writer of writers.slice(0,2)) {
  for (const [wallet, tx] of [[issuer, {TransactionType:'CredentialCreate', Subject:writer.classicAddress,CredentialType:credentialType}], [writer,{TransactionType:'CredentialAccept',Issuer:issuer.classicAddress,CredentialType:credentialType}]] as [Wallet, Partial<Transaction>][]) {
   const prepared = await client.autofill({...tx, Account:wallet.classicAddress} as Transaction)
   if (Number(prepared.Fee) > 2000) throw Error('Fee exceeds cap')
   const signed = wallet.sign(prepared)
   const result = await client.submitAndWait(signed.tx_blob)
   const meta = result.result.meta
   if (!result.result.validated || typeof meta !== 'object' || meta.TransactionResult !== 'tesSUCCESS') throw Error(`Credential transaction failed: ${typeof meta === 'object' ? meta.TransactionResult : 'missing metadata'}`)
   transactions.push({hash:signed.hash,ledgerIndex:result.result.ledger_index,operation:tx.TransactionType,subject:writer.classicAddress,issuer:issuer.classicAddress,credentialTypeText,feeDrops:prepared.Fee,date:new Date().toISOString().slice(0,10),group:'Testnet, credential',source:`${dir}/transactions.json`})
   writeFileSync(`${dir}/transactions.json`,JSON.stringify({transactions},null,2)+'\n')
  }
 }
 const verifier = new WriterCredentials([{issuer:issuer.classicAddress,credentialType,label:'ResearchAgent fixture issuer'}],credentialRpc(),10_000)
 const observations = []
 for (const w of writers) observations.push({wallet:w.classicAddress,verification:publicObservation(await verifier.check(w.classicAddress))})
 writeFileSync(`${dir}/observations.json`,evidenceJson({label:'LIVE TESTNET · synthetic writers · identity only · no purchases',observations})+'\n')
 if (observations.map(o=>o.verification.status).join(',') !== 'verified,verified,unverified') throw Error('Unexpected verifier observations; inspect public evidence')

 // Fixture publisher corpus with existing Testnet seller wallets. Only public metadata is read.
 const corpus = await loadWriterCorpus()
 const publishers = corpus.publishers.filter(p => corpus.articles.some(a => a.publisherSlug === p.slug && a.tier === 'PAID')).slice(0,3)
 const slugs = new Set(publishers.map(p => p.slug))
 const env = { ...process.env }
 publishers.forEach((p,i) => { env[`XRPL_PUBLISHER_${p.slug.toUpperCase().replaceAll('-','_')}_SEED`] = writers[i].seed })
 process.env.WRITER_CREDENTIAL_ISSUERS = JSON.stringify([{issuer:issuer.classicAddress,credentialType,label:'ResearchAgent fixture issuer'}])
 const app = createPublisherApp({writers:{publishers,writers:corpus.writers.filter(w=>slugs.has(w.publisherSlug)),articles:corpus.articles.filter(a=>slugs.has(a.publisherSlug))},rail:'xrpl-testnet',journal:':memory:',env})
 await app.locals.ready; await app.locals.writersReady
 const server=app.listen(0,'127.0.0.1');await once(server,'listening')
 try {
  const client=new PublisherClient({baseUrl:`http://127.0.0.1:${(server.address() as {port:number}).port}`})
  await client.registry()
  const labels=[]
  for(const [i,p] of publishers.entries()) {
   const hits=await client.searchPublisher(p.slug,'Kestrel semiconductor',5)
   if(!hits.length) throw Error('Fixture writer returned no hits')
   if (hits[0].tier === 'FREE') await client.readFree(hits[0],p.name)
   labels.push({writer:p.slug,wallet:writers[i].classicAddress,verification:hits[0].verification && publicObservation(hits[0].verification)})
  }
  writeFileSync(`${dir}/engine.json`,evidenceJson({label:'SYNTHETIC corpus; live Testnet credentials; public metadata only; no purchase or model calls',labels})+'\n')
  if(labels.map(o=>o.verification?.status).join(',')!=='verified,verified,unverified') throw Error('Unexpected verifier observations in engine fixture')
 } finally {await new Promise<void>(r=>server.close(()=>r()));app.locals.journal.close()}
 console.log('Testnet credential issue/accept and engine 2 verified + 1 unverified checks passed')
} catch (e) {
 // Never serialize SDK errors, which may embed signed request blobs.
 const message = e instanceof Error && /Credential transaction failed|Wrong network|Unexpected verifier/.test(e.message) ? e.message : 'Testnet connection or RPC unavailable'
 writeFileSync(`${dir}/availability.json`,JSON.stringify({at:new Date().toISOString(),status:message,transactionsCompleted:transactions.length},null,2)+'\n')
 console.error(message); process.exitCode=1
} finally { await client.disconnect() }
