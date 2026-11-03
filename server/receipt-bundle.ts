import { contributions } from '../shared/contribution.js'
import { sameSource } from '../shared/source-identity.js'
import { ReceiptBundleSchema, type ReceiptBundle } from '../shared/contracts/receipts.js'
import type { Store } from './store.js'
import { GENESIS_HASH } from './audit.js'

export function receiptBundle(store: Store, runId: string): ReceiptBundle {
  const run = store.getRun(runId)
  const entries = store.auditEntries(), first = entries.findIndex(e => e.runId === runId)
  const anchor = first > 0 ? { seq: entries[first - 1].seq, hash: entries[first - 1].hash } : { seq: 0, hash: GENESIS_HASH }
  return ReceiptBundleSchema.parse({
    schemaVersion: run.receipts.length ? 3 : run.candidates.some(c => c.source) ? 2 : 1, identityVersion: run.receipts.length ? (run.candidates.some(c => c.source) ? 2 : 1) : undefined, contributions: run.receipts.length ? contributions({ ...run, sources: run.contents }) : undefined, runId, label: `${run.labels.settlement}; ${run.labels.research}; writer identity unverified`,
    requirements: run.checkpoint.requirements ?? [], answers: run.answers, sources: run.contents, candidates: run.candidates, intents: run.intents,
    grants: run.grants.filter(g => run.intents.some(i => i.intentId === g.intentId && i.status === 'VERIFIED')),
    receipts: run.receipts, payments: store.receiptRows().filter(r => r.runId === runId),
    proofs: run.contents.flatMap(source => {
      const intent = run.intents.find(i => i.status === 'VERIFIED' && sameSource(i, source))
      if (!intent) return source.verification ? [{ source: source.source, resourceId: source.resourceId, version: source.version, ...source.verification }] : []
      const manifest = store.getManifest(intent.intentId), delivery = store.getDelivery(intent.intentId)
      return manifest && delivery ? [{ source: source.source, resourceId: source.resourceId, version: source.version, intentId: intent.intentId, manifest, salts: delivery.salts }] : []
    }),
    audit: { anchor, entries: entries.slice(Math.max(0, first)).map(e => e.runId === runId ? e : { seq: e.seq, prevHash: e.prevHash, hash: e.hash, commitment: true }), head: entries.at(-1)?.hash ?? GENESIS_HASH },
  })
}
