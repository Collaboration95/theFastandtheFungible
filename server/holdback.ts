// Buyer policy only. This module owns F2, sequence reservations and holdback settlement.
import { decode, type Transaction } from 'xrpl'
import { batchInners, createPair, innerHash, keyTerms, matchesHoldbackBatch, matchesHoldbackObject, splitHoldback } from '../shared/holdback.js'
import { ledgerTime, fulfillmentFor, newHashlock } from '../shared/escrow.js'
import { lookupTx } from '../shared/xrpl.js'
import { loadConfig } from './config.js'
import { verifyEscrowCredit } from './escrow-asset.js'
import type { EscrowTerms } from '../shared/contracts/escrow.js'
import type { Store } from './store.js'
import type { Submission, XrplPayer } from './xrpl.js'
import { sameSource } from '../shared/source-identity.js'
import { marginalValue } from './agents/value-policy.js'
import { SEARCH_LABELS } from '../shared/contracts/index.js'
export type HoldbackPrivate = { secret: string; unsigned?: Transaction; signed?: Submission; terminal?: Submission & { operation: 'finish' | 'cancel' } }
export function holdbackOffer(amount: string, now: number, xrp: boolean) {
  const config = loadConfig()
  if (config.ESCROW_HOLDBACK !== 'on' || config.ESCROW_MODE !== 'key-reveal') return undefined
  const percent = Number(config.HOLDBACK_PERCENT || 20), lock = newHashlock()
  return { secret: lock.secret, terms: { condition: lock.condition, percent, amount: splitHoldback(amount,percent,xrp).amount, cancelAfter: now + Number(config.HOLDBACK_CANCEL_AFTER_S || 600) } }
}
export function restoreHoldbacks(store: Store, payer: XrplPayer) {
  for (const intent of store.listIntents()) {
    if (!intent.escrow?.holdback) continue
    const state = store.holdbackPrivate<HoldbackPrivate>(intent.intentId)
    if (state?.unsigned && !state.signed) {
      if (intent.status !== 'SUBMITTING') continue
      if (store.isPaused() || store.getRun(intent.runId).stopped) {
        store.withTransaction(() => { store.releaseHoldbackSequences(intent.intentId,true); store.failSubmission(intent.intentId,'Unsigned Batch abandoned before Stop or pause; nothing was charged') })
        continue
      }
      state.signed = payer.signReservedBatch(state.unsigned)
      store.withTransaction(() => {
        store.holdbackPrivate(intent.intentId,state)
        store.recordEscrowSubmission(intent.intentId,'create',state.signed!)
        const pair = batchInners(decode(state.signed!.txBlob))
        store.updateHoldback(intent.intentId,{...intent.escrow!.holdback!,batchHash:state.signed!.txHash,createHash:innerHash(pair[1]),createSequence:Number(pair[1].Sequence)})
      })
    }
    if (state?.signed) payer.restorePending([state.signed])
    if (state?.terminal) payer.restorePending([state.terminal])
  }
}
export async function createHoldback(store: Store, payer: XrplPayer, intentId: string, reservedFees: () => number) {
  const e = store.getEscrow(intentId)!, t = e.quote.terms
  const signed = store.escrowOutbox(intentId).find(s => s.operation === 'create')
  if (signed) return signed
  const sent = await payer.escrow({ TransactionType: 'Batch', Flags: 65536, RawTransactions: createPair(t).map(RawTransaction => ({ RawTransaction })) } as Omit<Transaction,'Account'>, t.asset === 'XRP' ? Number(t.amount) : 0,
    s => store.withTransaction(() => {
      const state = store.holdbackPrivate<HoldbackPrivate>(intentId)!
      store.holdbackPrivate(intentId,{ ...state,signed:s })
      store.recordEscrowSubmission(intentId,'create',s)
      const pair = batchInners(decode(s.txBlob))
      store.updateHoldback(intentId,{ ...e.publicStatus.holdback!,batchHash:s.txHash,createHash:innerHash(pair[1]),createSequence:Number(pair[1].Sequence) })
      return s
    }), async s => { try { await payer.ledger.request({ command:'submit',tx_blob:s.txBlob }) } catch { /* identical hash reconciles */ } },undefined,reservedFees,
    { reserve: unsigned => store.withTransaction(() => {
      const old = store.holdbackPrivate<HoldbackPrivate>(intentId)!
      if (old.unsigned) return old.unsigned
      const intent = store.getIntent(intentId)!
      if (store.isPaused() || store.getRun(intent.runId).stopped || intent.status !== 'SUBMITTING') throw Error('Purchase authority unavailable')
      store.reserveHoldbackSequences(intentId,t.payer,[0,1,2].map(i => Number(unsigned.Sequence)+i))
      store.holdbackPrivate(intentId,{ ...old,unsigned })
      store.recordAudit({runId:intent.runId,intentId,kind:'holdback-reserve',data:{owner:t.payer,sequences:[0,1,2].map(i=>Number(unsigned.Sequence)+i),amount:t.amount,holdbackAmount:t.holdback!.amount}})
      return unsigned
    }) })
  await sent.sent
  return store.escrowOutbox(intentId).find(s => s.operation === 'create')!
}
/** Require validated inner results plus both exact objects at their creation ledger. */
export async function verifyHoldbackBatch(payer: XrplPayer, signed: Submission, t: EscrowTerms): Promise<boolean> {
  const outer = await lookupTx(payer.ledger,signed.txHash)
  if (outer.state !== 'validated' || outer.meta.TransactionResult !== 'tesSUCCESS' || !matchesHoldbackBatch(outer.tx,t)) return false
  const pair = batchInners(outer.tx)
  for (let i=0;i<2;i++) {
    const found = await lookupTx(payer.ledger,innerHash(pair[i]))
    if (found.state !== 'validated' || found.meta.TransactionResult !== 'tesSUCCESS' || found.ledgerIndex !== outer.ledgerIndex || found.meta.ParentBatchID !== signed.txHash || innerHash(found.tx) !== innerHash(pair[i])) return false
    const node = (await payer.ledger.request({ command:'ledger_entry',escrow:{owner:t.payer,seq:Number(pair[i].Sequence)},ledger_index:outer.ledgerIndex })).result.node
    if (!matchesHoldbackObject(node,t,i === 1)) return false
  }
  return true
}
/** Existing promise proofs run before this call; unavailable live calibration stays pending. */
export function holdbackChecks(store: Store, intentId: string): 'pass' | 'fail' | undefined {
  const intent = store.getIntent(intentId)!, e = store.getEscrow(intentId)!
  if (e.publicStatus.state === 'CANCELLED' || e.publicStatus.proofOk === false || e.publicStatus.decryptVerified === false) return 'fail'
  if (intent.status !== 'VERIFIED' || !e.reveal) return undefined
  const run = store.getRun(intent.runId), content = run.contents.find(c => sameSource(c,intent)), candidate = run.candidates.find(c => sameSource(c,intent))
  if (!content || !run.grants.some(g => g.intentId === intentId)) return undefined
  if (candidate && !marginalValue({ candidate,evidence:run.contents.filter(c => !sameSource(c,intent)),probability:1,trust:1 }).eligible) return 'fail'
  // Live relevance uses the existing calibration observation, never a second model opinion.
  if (run.labels.search === SEARCH_LABELS[0]) {
    const observation = (run.checkpoint.holdbackCalibration as Record<string,{claimed:number;observed:number}> | undefined)?.[intentId]
    if (!observation) return undefined
    if (observation.observed < observation.claimed) return 'fail'
  }
  return 'pass'
}
const active = new WeakMap<Store,Map<string,Promise<void>>>()
export function settleHoldback(store: Store, payer: XrplPayer, intentId: string): Promise<void> {
  let map = active.get(store); if (!map) { map = new Map(); active.set(store,map) }
  const old = map.get(intentId); if (old) return old
  const task = settle(store,payer,intentId).finally(() => map!.delete(intentId)); map.set(intentId,task); return task
}
async function settle(store: Store, payer: XrplPayer, intentId: string) {
  const e = store.getEscrow(intentId)!, t = e.quote.terms, h = e.publicStatus.holdback
  if (!h || h.state !== 'pending' || !h.createSequence) return
  const state = store.holdbackPrivate<HoldbackPrivate>(intentId)!
  const now = await ledgerTime(payer.ledger)
  const checks = h.checks ?? holdbackChecks(store,intentId)
  if (checks && !h.checks) store.updateHoldback(intentId,{ ...h,checks })
  let terminal = state.terminal
  if (!terminal) {
    // At expiry cancellation also closes an unavailable check, without releasing F2.
    if (checks !== 'pass' && now <= h.cancelAfter) return
    const operation = checks === 'pass' && now + 15 < h.cancelAfter ? 'finish' : now > h.cancelAfter ? 'cancel' : undefined
    if (!operation) return
    const sent = await payer.escrow(operation === 'finish' ? { TransactionType:'EscrowFinish',Owner:t.payer,OfferSequence:h.createSequence,Condition:h.condition,Fulfillment:fulfillmentFor(state.secret) } : { TransactionType:'EscrowCancel',Owner:t.payer,OfferSequence:h.createSequence },0,
      s => store.withTransaction(() => {
        store.holdbackPrivate(intentId,{ ...state,terminal:{...s,operation} })
        store.recordAudit({runId:store.getIntent(intentId)!.runId,intentId,kind:'holdback-sign',data:{operation,txHash:s.txHash,owner:t.payer,createSequence:h.createSequence,checks:checks ?? 'unavailable'}})
        return s
      }),
      s => payer.ledger.request({ command:'submit',tx_blob:s.txBlob }), async () => {
        if (operation === 'finish' && (holdbackChecks(store,intentId) !== 'pass' || await ledgerTime(payer.ledger) + 15 >= h.cancelAfter)) throw Error('Holdback release authority unavailable')
      }, () => store.listIntents().filter(i => i.intentId !== intentId && i.escrow).reduce((sum,i) => sum + (i.status === 'SUBMITTING' ? 2000 : 0) + (i.escrow?.holdback?.state === 'pending' ? 2000 : 0),0))
    await sent.sent; terminal = { ...sent.submission,operation }
  } else {
    try { await payer.ledger.request({ command:'submit',tx_blob:terminal.txBlob }) } catch { /* hash decides */ }
  }
  const outcome = await payer.waitFor(terminal)
  if (outcome.state === 'failed' || outcome.state === 'expired') {
    // No new principal. A ledger-proven failed terminal may be retried after expiry.
    store.holdbackPrivate(intentId,{ ...state,terminal:undefined }); return
  }
  if (outcome.state !== 'success') return
  const found = await lookupTx(payer.ledger,terminal.txHash)
  if (found.state !== 'validated' || found.tx.Owner !== t.payer || found.tx.OfferSequence !== h.createSequence || found.tx.TransactionType !== (terminal.operation === 'finish' ? 'EscrowFinish' : 'EscrowCancel')) return
  verifyEscrowCredit(found.meta,{ ...keyTerms(t),amount:h.amount },terminal.operation === 'finish' ? t.payTo : t.payer)
  store.withTransaction(() => {
    const result = terminal!.operation === 'finish' ? 'released' : 'refunded'
    store.updateHoldback(intentId,{ ...h,checks,state:result,[terminal!.operation + 'Hash']:terminal!.txHash,ledgerIndex:outcome.ledgerIndex })
    store.recordAudit({ runId:store.getIntent(intentId)!.runId,intentId,kind:'holdback',data:{state:result,txHash:terminal!.txHash,owner:t.payer,createSequence:h.createSequence,amount:h.amount,ledgerIndex:outcome.ledgerIndex} })
    store.appendEvent(store.getIntent(intentId)!.runId,{type:'HOLDBACK',label:`Holdback ${result}`,data:{intentId,txHash:terminal!.txHash,amountMinor:h.amountMinor}})
  })
}
