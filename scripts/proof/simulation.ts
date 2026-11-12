import { Store } from '../../server/store.js'
import { PurchaseManager } from '../../server/purchases.js'
import { PublisherClient } from '../../server/publisher-client.js'
import { SimulatedPayer, type Submission } from '../../server/xrpl.js'
import { exampleCandidate, exampleAnswer } from '../../shared/contracts/examples.js'
import { SIMULATED_LABEL, type PaymentRequirement } from '../../shared/contracts/index.js'
import { leafHash, manifestRoot, signManifest } from '../../shared/manifest.js'
import { invoiceIdFor, ledgerInvoiceId, decodeHeader } from '../../shared/x402.js'
import { deriveKeypair, deriveAddress, generateSeed } from 'ripple-keypairs'

export const boundaries = ['reserveIntent','claimSubmitting','recordSubmission','recordSettlement','addGrant','recordProof'] as const
export const faults = [...boundaries, 'before-submit', 'after-submit', 'duplicate-submit', 'ledger-delay', 'validation-failure', 'bad-delivery', 'none'] as const
export type SimFault = typeof faults[number]
const keys = deriveKeypair(generateSeed({ algorithm: 'ed25519' })), wallet = deriveAddress(keys.publicKey)
const salts = ['5a17'], body = 'PREMIUM_CANARY: exact verified evidence.'
const spans = [{ id: 'proof-span', text: 'exact verified evidence.' }]
const root = manifestRoot([leafHash(salts[0], 0, spans[0].id, spans[0].text)])
const templates = ['proof-a', 'proof-b'].map(resourceId => {
  const manifest = signManifest({ publisherSlug:'proof-writer',articleId:resourceId,version:'v1',wallet,pubKey:keys.publicKey,priceMinor:40,leaves:[leafHash(salts[0],0,spans[0].id,spans[0].text)],root,claims:[],wordCount:5,publishedAt:'2026-11-12',relevance:1 }, keys.privateKey)
  const candidate = { ...exampleCandidate, profileId:'proof-writer',resourceId,version:'v1',tier:'PAID' as const,wallet,manifest,price:{amountMinor:40,currency:'SGD' as const} }
  const invoiceId = invoiceIdFor({quoteId:resourceId,articleId:resourceId,version:'v1',manifestRoot:root,amount:'40000',payTo:wallet})
  return { candidate, invoiceId, submission: undefined as Submission | undefined }
})
// Sign each fixed fixture once. The fake payer below replays these genuine blobs; no signing benchmark.
for (const t of templates) await new SimulatedPayer().pay({ rail:'simulated',network:'xrpl:1',asset:'XRP',payTo:wallet,amountDrops:'40000',invoiceId:ledgerInvoiceId(t.invoiceId) }, s => { t.submission=s; return s }, async () => undefined)
class FixturePayer extends SimulatedPayer {
  constructor(readonly signs: Map<string,number> = new Map()) { super() }
  override async pay<T>(terms: PaymentRequirement, persist: (s: Submission) => Submission, send: (s: Submission) => Promise<T>) {
    const t = templates.find(t => ledgerInvoiceId(t.invoiceId) === terms.invoiceId)!
    this.signs.set(t.candidate.resourceId,(this.signs.get(t.candidate.resourceId)??0)+1)
    const submission = persist(t.submission!)
    return { submission, sent: send(submission) }
  }
}
export async function schedules(runs: number, seed: number, progress?: (n: number) => void) {
  let rngState = seed >>> 0
  const random = () => { rngState ^= rngState << 13; rngState ^= rngState >>> 17; rngState ^= rngState << 5; return (rngState >>> 0)/4294967296 }
  const violations = { G1:0,G2:0,G3:0,G4:0,G5:0 }, byFault: Record<string,number> = {}, exercised: Record<string,number> = {}, outcomes: Record<string,number> = {}
  let store: Store | undefined
  let runId = '', fault: SimFault = 'none', fired = false
  const charges = new Map<string,number>(), signs = new Map<string,number>()
  const snapshot = () => {
    const run = store!.getRun(runId)
    if (run.spentMinor + run.reservedMinor > run.budgetMinor) violations.G2++
    if (run.contents.length && (!run.grants.length || run.contents.some(c => !run.grants.some(g => g.resourceId === c.resourceId && run.intents.some(i => i.intentId === g.intentId && i.status === 'VERIFIED'))))) violations.G1++
    const audit = store!.auditEntries()
    for (const e of audit.filter(e => e.kind === 'read_paid')) if (!audit.some(g => g.kind === 'grant' && g.intentId === e.intentId && g.seq < e.seq)) violations.G1++
    if (!run.labels?.settlement.includes('SIMULATED') || run.receipts.some(r => !r.label.includes('SIMULATED'))) violations.G5++
    return run
  }
  // The fixture signer is stateless; only the real manager is recreated on recovery.
  const fixturePayer = new FixturePayer(signs)
  const simulatedAddress = fixturePayer.address
  const client = new PublisherClient()
  client.paidGet = async (path, signature) => {
    const t = templates.find(t => path.endsWith(t.candidate.resourceId))!
    if (!signature) return {status:402,required:{x402Version:2,resource:{url:path,description:SIMULATED_LABEL},accepts:[{scheme:'exact',network:'xrpl:1',asset:'XRP',amount:'40000',payTo:wallet,maxTimeoutSeconds:60,extra:{invoiceId:t.invoiceId,areFeesSponsored:false}}]}}
    if (!fired && ['before-submit','ledger-delay','validation-failure'].includes(fault)) {
      fired = true
      if (fault === 'validation-failure') return {status:402,response:{success:false,transaction:'',network:'xrpl:1',errorReason:'Synthetic validation failure'}}
      await Promise.resolve(); throw Error('Synthetic unavailable ledger before validation')
    }
    const blob = decodeHeader('PAYMENT-SIGNATURE',signature).payload.signedTxBlob
    if (blob !== t.submission!.txBlob) throw Error('Unexpected signed blob')
    // In-memory ledger's idempotent application, independent of buyer receipts.
    if (!charges.has(t.submission!.txHash)) charges.set(t.submission!.txHash,1)
    if (!fired && fault === 'after-submit') { fired=true; throw Error('Synthetic lost settlement response') }
    if (!fired && fault === 'duplicate-submit') { fired=true; await Promise.resolve(); if (!charges.has(t.submission!.txHash)) charges.set(t.submission!.txHash,1) }
    const delivery = {articleId:t.candidate.resourceId,version:'v1',title:'Fixture evidence',publisher:'Proof writer',body,passages:spans,salts}
    if (!fired && fault === 'bad-delivery') { fired=true; delivery.body='tampered premium body' }
    return {status:200,response:{success:true,transaction:t.submission!.txHash,payer:simulatedAddress,network:'xrpl:1'},delivery}
  }
  try {
    for (let n=0;n<runs;n++) {
      fault = n < faults.length ? faults[n] : faults[Math.floor(random()*faults.length)]
      fired=false; charges.clear(); signs.clear()
      store = new Store(':memory:')
      const budget = n < faults.length ? 80 : random()<0.15 ? 0 : random()<0.5 ? 40 : 80
      runId = store.createRun('SYNTHETIC crash/retry proof schedule',budget).runId
      // Crash exceptions occur AFTER the real SQLite operation commits; retain the same DB and ledger.
      for (const boundary of boundaries) {
        const original = Reflect.get(store,boundary).bind(store) as (...args: unknown[]) => unknown
        Reflect.set(store,boundary,(...args: unknown[]) => {
          const result = original(...args)
          if (boundary === 'addGrant' || boundary === 'recordProof') snapshot()
          if (fault === boundary && !fired) { fired = true; throw Error('SYNTHETIC crash after durable '+boundary) }
          return result
        })
      }
      let manager = new PurchaseManager(store,client,fixturePayer)
      const input = {runId,candidate:templates[0].candidate,intentId:'first'}
      const other = {runId,candidate:templates[random()<0.5?0:1].candidate,intentId:'second'}
      await Promise.allSettled([manager.purchase(input),manager.purchase(input),manager.purchase(other)])
      snapshot()
      manager = new PurchaseManager(store,client,fixturePayer)
      for (let retry=0;retry<2;retry++) {
        await manager.reconcile()
        await Promise.allSettled([manager.purchase(input),manager.purchase(other)])
      }
      const run=snapshot()
      if ([...signs.values()].some(c => c>1) || [...charges.values()].some(c => c>1) || run.receipts.length > new Set(run.receipts.map(r => r.intentId)).size) violations.G3++
      // The real storage boundary rejects invented model citations even after a crash/recovery.
      try { store.addAnswer(runId,{...exampleAnswer,version:1,claims:[{id:'fake',stance:'SUPPORTS',text:'Fake',citations:[{resourceId:'nonexistent',version:'v1',spanId:'fake'}]}]}); violations.G4++ } catch { /* refusal expected */ }
      for(const i of run.intents) outcomes[i.status]=(outcomes[i.status]??0)+1
      byFault[fault]=(byFault[fault]??0)+1
      if (fired) exercised[fault]=(exercised[fault]??0)+1
      if (budget>0 && fault !== 'none' && !fired) throw Error(`Fault not exercised: ${fault}, schedule ${n}, seed ${seed}`)
      if (Object.values(violations).some(Boolean)) throw Error(JSON.stringify({schedule:n,seed,fault,violations}))
      if (n+1 < runs) store.close()
      if ((n+1)%1000===0) progress?.(n+1)
    }
  } finally { store?.close() }
  return {runs,seed,violations,byFault,exercised,outcomes}
}
