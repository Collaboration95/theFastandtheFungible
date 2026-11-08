// Deterministic policy outbox. No model or provider participates in anchoring.
import { decode } from 'xrpl'
import { createHash } from 'node:crypto'
import { canonical } from './audit.js'
import type { Store } from './store.js'
import { XrplPayer, type Submission } from './xrpl.js'
import { lookupTx } from '../shared/xrpl.js'
import { ANCHOR_PENDING_LABEL } from '../shared/anchor-status.js'
export type AnchorRecord = { runId: string; head: string; seq: number; answersHash: string; submission?: Submission; failed?: boolean }
const hash = (s: string) => createHash('sha256').update(s).digest('hex')
export class AnswerAnchors {
  private jobs = new Map<string, Promise<void>>()
  private closing = new AbortController()
  /** Bounded validation wait: 20 x 3 s stays inside the answer screen's 90 s polling window. */
  private attempts: number
  private intervalMs: number
  constructor(private store: Store, private payer: XrplPayer, opts: { lookupAttempts?: number; lookupIntervalMs?: number } = {}) {
    this.attempts = Math.max(1, opts.lookupAttempts ?? 20); this.intervalMs = opts.lookupIntervalMs ?? 3000
    payer.restorePending(store.anchorRows().filter(r => r.submission && !r.failed && !store.getRun(r.runId).ledgerAnchor).map(r => r.submission!))
  }
  ensure(runId: string): Promise<void> {
    const existing = this.jobs.get(runId)
    if (existing) return existing
    const job = this.perform(runId).catch(() => {
      this.store.appendEvent(runId, { type: 'SNAPSHOT', label: 'Anchor unavailable (submission or validation failed)' })
    }).finally(() => this.jobs.delete(runId))
    this.jobs.set(runId, job); return job
  }
  private async perform(runId: string) {
    const run = this.store.getRun(runId)
    if (!run.receipts.length && run.phase !== 'DONE') return // Incomplete abstentions are not attestations.
    if (!['DONE','STOPPED','FAILED'].includes(run.phase) || !run.answers.length || run.labels.settlement !== 'XRPL TESTNET · no real value') return
    const answersHash = hash(canonical(run.answers))
    let row = this.store.anchorRows().filter(r => r.runId === runId).at(-1)
    if (!row || row.answersHash !== answersHash || this.store.auditEntries().some(e => e.runId === runId && e.seq > row!.seq)) {
      this.store.recordAudit({ runId, kind: 'answer-anchor', data: { answersHash } })
      const tip = this.store.auditEntries().at(-1)!
      row = { runId, head: tip.hash, seq: tip.seq, answersHash }; this.store.saveAnchor(row)
      this.store.updateRun(runId, { ledgerAnchor: undefined })
    }
    if (row.failed || run.ledgerAnchor?.head === row.head) return
    const record = row
    if (!record.submission) {
      const signed = await this.payer.anchor(`${record.head}:${hash(runId)}`, s => {
        record.submission = s; this.store.saveAnchor(record); return s
      }, async s => { try { await this.payer.ledger.request({ command: 'submit', tx_blob: s.txBlob }) } catch { /* recover persisted hash */ } })
      await signed.sent
    } else {
      const status = await this.payer.status(record.submission)
      if (status.state === 'expired' || status.state === 'failed') { record.failed = true; this.store.saveAnchor(record); this.store.appendEvent(runId, { type: 'SNAPSHOT', label: `Anchor unavailable (${status.state})` }); return }
      if (status.state !== 'success') { try { await this.payer.ledger.request({ command: 'submit', tx_blob: record.submission.txBlob }) } catch { /* hash decides */ } }
    }
    const found = await this.awaitValidated(runId, record.submission!.txHash)
    if (!found) return
    if (found.meta.TransactionResult !== 'tesSUCCESS') { this.store.appendEvent(runId, { type: 'SNAPSHOT', label: 'Anchor unavailable (failed)' }); return }
    const tx = decode(record.submission!.txBlob)
    this.store.updateRun(runId, { ledgerAnchor: { version: 'anchor-v1', network: 'xrpl:1', head: record.head, runIdHash: hash(runId), account: this.payer.address!, txHash: record.submission!.txHash, ledgerIndex: found.ledgerIndex, feeDrops: String(tx.Fee) } })
    this.store.appendEvent(runId, { type: 'SNAPSHOT', label: `Anchored on XRPL · ${run.receipts.length ? '' : 'no purchase · '}anchor fee ${tx.Fee} drops (Testnet) · ledger ${found.ledgerIndex}` })
  }
  /** Pending is a progress state, not a failure: say so once, retry within bounds, and only then give a terminal label. */
  private async awaitValidated(runId: string, txHash: string) {
    for (let attempt = 1; ; attempt++) {
      const found = await lookupTx(this.payer.ledger, txHash)
      if (found.state === 'validated') return found
      if (attempt === 1) this.store.appendEvent(runId, { type: 'SNAPSHOT', label: ANCHOR_PENDING_LABEL })
      if (attempt >= this.attempts) break
      await new Promise<void>(resolve => {
        const done = () => { clearTimeout(timer); this.closing.signal.removeEventListener('abort', done); resolve() }
        const timer = setTimeout(done, this.intervalMs)
        this.closing.signal.addEventListener('abort', done)
      })
      if (this.closing.signal.aborted) return undefined // Shutdown: the reconciler resumes it next start.
    }
    this.store.appendEvent(runId, { type: 'SNAPSHOT', label: 'Anchor unavailable (validation not confirmed in time)' })
    return undefined
  }
  async reconcile() { for (const run of this.store.listRuns()) await this.ensure(run.runId).catch(() => undefined) }
  async drain() { this.closing.abort(); await Promise.allSettled(this.jobs.values()) }
}
