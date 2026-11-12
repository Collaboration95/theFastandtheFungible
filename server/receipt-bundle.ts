import { decode } from 'xrpl'
import type { HoldbackPrivate } from './holdback.js'
import { contributions } from '../shared/contribution.js'
import { sameSource } from '../shared/source-identity.js'
import { ReceiptBundleSchema, type ReceiptBundle } from '../shared/contracts/receipts.js'
import type { Store } from './store.js'
import { GENESIS_HASH } from './audit.js'

export function receiptBundle(store: Store, runId: string): ReceiptBundle {
  const run = store.getRun(runId)
  const pinned = store.anchorRows().filter(a => a.runId === runId).at(-1)
  const entries = store.auditEntries().filter(e => !pinned || e.seq <= pinned.seq), first = entries.findIndex(e => e.runId === runId)
  const anchor = first > 0 ? { seq: entries[first - 1].seq, hash: entries[first - 1].hash } : { seq: 0, hash: GENESIS_HASH }
  return ReceiptBundleSchema.parse({
    holdbacks: run.intents.filter(i => i.escrow?.holdback?.batchHash).map(i => { const p = store.holdbackPrivate<HoldbackPrivate>(i.intentId)!; return {intentId:i.intentId,batch:decode(p.signed!.txBlob),...(p.terminal && i.escrow!.holdback!.state !== 'pending' ? {terminal:decode(p.terminal.txBlob)} : {})} }),
    fraudProofs: run.intents.filter(i => i.escrow?.mode === 'key-reveal' && i.escrow.state === 'RELEASED' && i.failedClaimIds?.length).map(i => {
      const e = store.keyRevealEvidence(i.intentId)
      return { intentId: i.intentId, manifest: e.manifest, quote: e.quote, key: e.key, finishHash: e.finishHash, ledgerIndex: e.ledgerIndex, ciphertextHash: e.quote.terms.keyReveal!.ciphertextHash, failedClaimIds: i.failedClaimIds! }
    }),
    ledgerAnchor: run.ledgerAnchor,
    schemaVersion: run.receipts.length ? 3 : run.candidates.some(c => c.source) ? 2 : 1, identityVersion: run.receipts.length ? (run.candidates.some(c => c.source) ? 2 : 1) : undefined, contributions: run.receipts.length ? contributions({ ...run, sources: run.contents }) : undefined, runId, label: `${run.labels.settlement}; ${run.labels.research}; writer identity unverified${run.intents.some(i => i.purchaseKind) ? '; probe purchase · new writer' : ''}${run.candidates.some(c => c.publisherSlug === 'team-xrpl-explainers') ? '; team-authored explainer · sources cited · not an independent writer · Testnet' : ''}${run.candidates.some(c => c.publisherSlug === 'team-builder-notes') ? '; team-authored · real content · not an independent writer · Testnet' : ''}`,
    requirements: run.checkpoint.requirements ?? [], answers: run.answers, sources: run.contents, candidates: run.candidates.map(candidate => ({ ...candidate, verification: undefined })), intents: run.intents,
    grants: run.grants.filter(g => run.intents.some(i => i.intentId === g.intentId && i.status === 'VERIFIED')),
    receipts: run.receipts, payments: store.receiptRows().filter(r => r.runId === runId),
    proofs: run.contents.flatMap(source => {
      const intent = run.intents.find(i => i.status === 'VERIFIED' && sameSource(i, source))
      if (!intent) return source.verification ? [{ source: source.source, resourceId: source.resourceId, version: source.version, ...source.verification }] : []
      const manifest = store.getManifest(intent.intentId), delivery = store.getDelivery(intent.intentId)
      return manifest && delivery ? [{ source: source.source, resourceId: source.resourceId, version: source.version, intentId: intent.intentId, manifest, salts: delivery.salts, ...(intent.escrow?.mode === 'key-reveal' ? { keyReveal: store.keyRevealEvidence(intent.intentId) } : {}) }] : []
    }),
    audit: { anchor, entries: entries.slice(Math.max(0, first)).map(e => e.runId === runId ? e : { seq: e.seq, prevHash: e.prevHash, hash: e.hash, commitment: true }), head: entries.at(-1)?.hash ?? GENESIS_HASH },
  })
}
