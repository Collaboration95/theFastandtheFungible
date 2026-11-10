import { sourceKey } from '../../shared/source-identity.js'
import { deriveAddress } from 'ripple-keypairs'
import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { decode, hashes } from 'xrpl'
import { PublisherJournal } from '../../publisher/journal.js'
import { Facilitator, requirementsFor, paymentResponse } from '../../publisher/facilitator.js'
import { decodeHeader, encodeHeader, invoiceIdFor, ledgerInvoiceId } from '../../shared/x402.js'
import { DROPS_PER_MINOR, XRPL_LABEL } from '../../shared/contracts/index.js'
import { verifyPayment } from '../../shared/xrpl.js'
import { presentRun } from '../../sdk/present.js'
import type { ApiContext } from '../api/context.js'
import { admit } from '../spend-policy.js'
import { screenPayee } from '../payee-screening.js'
import { freezeRequirements, plan as planSearch } from '../agents/scope.js'
import { SERVICE_FEE_MINOR, royaltyPlan, changePlan } from './policy.js'
import { XrplPayer } from '../xrpl.js'
import { HireJournal, type Hire } from './journal.js'

const Input = z.object({ question: z.string().trim().min(1).max(2000), budgetMinor: z.union([z.literal(100), z.literal(200), z.literal(500)]) }).strict()
/** Payment authority is a settled invoice, never a model tool. No browser/UI surface. */
export function hireService(context: ApiContext) {
  const { store, payer, loop } = context
  // Same SQLite file; isolated tables avoid purchase-manager changes.
  const journal = new PublisherJournal(store.path)
  const hires = new HireJournal(store.path)
  const facilitator = payer ? new Facilitator(journal, 'xrpl-testnet', payer.ledger) : undefined
  payer?.restorePending(store.listRuns().flatMap(run => store.policyPayments(run.runId)
    .flatMap(p => p.submission && !p.confirmedAt ? [p.submission] : [])))
  const active = new Map<string, Promise<unknown>>()
  const router = Router()
  async function finish(hire: Hire, principal: string) {
    const runId = hire.runId!
    let run = store.getRun(runId)
    const recoveryIntent = typeof run.checkpoint.recoveryIntentId === 'string' ? run.checkpoint.recoveryIntentId : run.checkpoint.intentId
    const needsAnswer = !run.stopped && recoveryIntent && run.checkpoint.answeredIntentId !== recoveryIntent && run.intents.some(i => i.intentId === recoveryIntent && i.status === 'VERIFIED')
    if (needsAnswer) await context.launch(runId, () => loop.recoverAnswer(runId, recoveryIntent!), () => undefined)
    else if (!['DONE', 'STOPPED', 'FAILED'].includes(run.phase)) {
      await context.launch(runId, async () => {
        const planned = await planSearch(hire.question, {}, loop.signal(runId))
        const frozen = freezeRequirements(hire.question, planned)
        const { label, requirements: _texts, requirementsKey: _key, ...plan } = planned
        store.updateRun(runId, { labels: { ...run.labels, plan: label }, checkpoint: { ...run.checkpoint, plan, requirements: frozen.requirements, requirementsBy: frozen.source === 'plan' ? label : 'fixture · scope-fixture' } })
        store.appendEvent(runId, { type: 'PLAN', label: `Hire research plan (${label})`, data: { plan } })
        await loop.start(runId)
      }, () => undefined)
    }
    run = store.getRun(runId)
    const savedAddresses = hires.get(hire.key)!.writerAddresses
    const addresses = savedAddresses ?? await (async () => {
      const origins=context.client.origins()
      const discovered=await Promise.allSettled(origins.map(async origin => ({origin:origin.origin,writers:await origin.registry()})))
      const roster=discovered.flatMap(r=>r.status === 'fulfilled' ? [r.value] : [])
      const resolved: Record<string,string>={}
      for (const candidate of run.candidates) {
        if (!candidate.source) {
          if (origins.length === 1 && !origins[0].options.federated) {
            const writer=roster[0]?.writers.find(w=>w.slug === candidate.profileId)
            if(writer?.wallet) resolved[candidate.profileId]=writer.wallet
          }
          continue
        }
        const writer=roster.find(r=>r.origin === candidate.source!.origin)?.writers.find(w=>w.slug === candidate.profileId)
        try { if (writer?.wallet && deriveAddress(candidate.source.sellerKey) === writer.wallet) resolved[sourceKey(candidate)]=writer.wallet } catch { /* unresolved signing key pays nobody */ }
      }
      return hires.patch(hire.key,{writerAddresses:resolved}).writerAddresses!
    })()
    let royalties
    try { royalties=royaltyPlan(run,addresses) }
    catch {
      store.appendEvent(runId,{type:'ROYALTY_UNRESOLVED',label:'Unresolved writer identity; no royalty payment authorized'})
      throw new Error('Unresolved writer identity; no royalty payment authorized')
    }
    const change = changePlan(run, hire.budgetMinor, principal)
    store.reservePolicyPayments(runId, [...royalties, ...change])
    for (const payment of store.policyPayments(runId)) {
      const refusal = !payment.submission && !payment.cancelledAt && payment.kind === 'royalty' ? screenPayee(payment.payTo) : undefined
      if (refusal) store.cancelRefusedRoyalty(runId, payment.id, principal, { reason: refusal.refusal, screen: refusal.list, listReason: refusal.reason ?? null })
    }
    for (const payment of store.policyPayments(runId)) {
      if (payment.confirmedAt || payment.cancelledAt) continue
      const screened = screenPayee(payment.payTo)
      if (screened) {
        store.recordAudit({ runId, intentId: payment.id, kind: 'refusal', data: { stage: 'payout', reason: screened.refusal, paymentKind: payment.kind, payTo: payment.payTo, amountDrops: payment.amountDrops, screen: screened.list, listReason: screened.reason ?? null } }, { stage: 'payout', paymentId: payment.id })
        throw new Error(screened.refusal)
      }
      const terms = { rail: 'xrpl-testnet' as const, network: 'xrpl:1' as const, asset: 'XRP' as const,
        payTo: payment.payTo, amountDrops: payment.amountDrops, invoiceId: ledgerInvoiceId(payment.id), memo: JSON.stringify({ runId, kind: payment.kind, intentId: payment.id }) }
      const send = async (signed: import('../xrpl.js').Submission) => {
        // Pause/caps are checked both before signing and before every resend.
        store.assertPolicyPaymentAllowed(runId)
        const current = await verifyPayment(payer!.ledger, signed.txHash, terms).catch(() => ({ state: 'pending' as const }))
        if (current.state !== 'ok') await payer!.ledger.request({ command: 'submit', tx_blob: signed.txBlob })
        const outcome = await payer!.waitFor(signed)
        const proof = await verifyPayment(payer!.ledger, signed.txHash, terms)
        if (outcome.state !== 'success' || proof.state !== 'ok') throw new Error('Policy payment pending; resend original intent')
        store.confirmPolicyPayment(runId, payment.id, proof.proof.ledgerIndex)
        store.appendEvent(runId, { type: 'XRPL', label: `${payment.kind} · ${XRPL_LABEL}`, data: { kind: payment.kind, txHash: signed.txHash, amountDrops: payment.amountDrops, payTo: payment.payTo, invoiceId: terms.invoiceId } })
      }
      if (payment.submission) {
        const outcome = await payer!.status(payment.submission)
        if (outcome.state === 'expired' || outcome.state === 'failed') {
          store.retirePolicySubmission(runId, payment.id, payment.submission.txHash, outcome.state)
          payment.submission = undefined
        }
      }
      if (payment.submission) await send(payment.submission)
      else {
        const paid = await payer!.pay(terms, signed => store.recordPolicySubmission(runId, payment.id, signed), send)
        await paid.sent
      }
    }
    const settled = journal.settlementByTx(hashes.hashSignedTx(decodeHeader('PAYMENT-SIGNATURE', hire.signature!).payload.signedTxBlob).toUpperCase())!
    const payments = store.policyPayments(runId).filter(p => !p.cancelledAt).map(p => ({ id: p.id, kind: p.kind, payTo: p.payTo, amountDrops: p.amountDrops,
      txHash: p.submission!.txHash, explorerUrl: `https://testnet.xrpl.org/transactions/${p.submission!.txHash}`, label: XRPL_LABEL }))
    const cancelled = store.policyPayments(runId).filter(p => p.cancelledAt)
    const refundedRoyaltyDrops = cancelled.reduce((s,p) => s + Number(p.amountDrops), 0)
    const royaltyDrops = royalties.reduce((s, p) => s + Number(p.amountDrops), 0)
    const changeDrops = change.reduce((s, p) => s + Number(p.amountDrops), 0) + refundedRoyaltyDrops
    const result = { ...presentRun(run, context.publisherUrl), moneyChain: {
      inbound: { txHash: settled.txHash, payer: principal, payTo: payer!.address, amountDrops: hire.quote.amount, explorerUrl: `https://testnet.xrpl.org/transactions/${settled.txHash}`, label: XRPL_LABEL },
      writerAddresses: addresses, cancelledRoyalties: cancelled.map(p => ({ id: p.id, payTo: p.payTo, amountDrops: p.amountDrops, reason: 'operator denylist' })), payments, purchaseDrops: String(run.spentMinor * DROPS_PER_MINOR), royaltyDrops: String(royaltyDrops - refundedRoyaltyDrops), changeDrops: String(changeDrops),
      retainedDrops: String(SERVICE_FEE_MINOR * DROPS_PER_MINOR - royaltyDrops), feePolicy: 'Network fees paid separately by each sender; not deducted from caller change', policy: 'hire-v1 · 25% of fixed S$0.20 fee; equal by distinct cited writer, slug-sorted remainder' } }
    hires.patch(hire.key, { result })
    store.closeHireReserve(runId)
    return result
  }
  function recordInbound(hire: Hire, principal: string, txHash: string, inbound: { ledgerIndex?: number; settledAt: string }) {
    store.recordAudit({ runId: hire.runId, intentId: hire.key, kind: 'inbound', surface: hire.agentId ? 'agent' : 'x402', principal: hire.agentId ?? principal, data: { txHash, payer: principal, payTo: hire.quote.payTo, amountDrops: hire.quote.amount,
      invoiceId: hire.quote.ledgerInvoiceId, ledgerIndex: inbound.ledgerIndex ?? null, settledAt: inbound.settledAt, policy: 'hire-v1', budgetMinor: hire.budgetMinor, serviceFeeMinor: SERVICE_FEE_MINOR, label: XRPL_LABEL } }, { txHash })
  }
  function resume(hire: Hire, principal: string) {
    let pending = active.get(hire.key)
    if (!pending) {
      pending = Promise.resolve().then(() => finish(hires.get(hire.key)!, principal)).finally(() => active.delete(hire.key))
      active.set(hire.key, pending)
    }
    return pending
  }
  /** No new inbound payment: only a ledger-proven original blob unlocks recovery. */
  async function recover(hire: Hire) {
    if (!payer || !facilitator || hire.quote.payTo !== payer.address) return
    const signature = decodeHeader('PAYMENT-SIGNATURE', hire.signature!)
    const txHash = hashes.hashSignedTx(signature.payload.signedTxBlob).toUpperCase()
    const terms = { rail: 'xrpl-testnet' as const, network: 'xrpl:1' as const, asset: 'XRP' as const, payTo: hire.quote.payTo, amountDrops: hire.quote.amount, invoiceId: hire.quote.ledgerInvoiceId }
    const proof = await verifyPayment(payer.ledger, txHash, terms)
    if (proof.state !== 'ok') {
      const tx = decode(signature.payload.signedTxBlob)
      const status = await payer.status({ txHash, txBlob: signature.payload.signedTxBlob, lastLedgerSequence: Number(tx.LastLedgerSequence) })
      if (status.state === 'expired' || status.state === 'failed') {
        store.updateRun(hire.runId!, { phase: 'FAILED', stopped: true })
        store.closeHireReserve(hire.runId!)
        hires.patch(hire.key, { inboundExpired: true })
      }
      return
    }
    const settled = await facilitator.settle(signature, { articleId: hire.key, version: 'hire-v1' })
    if (!settled.ok) return
    recordInbound(hire, proof.proof.payer, txHash, settled.settlement)
    await resume(hire, proof.proof.payer)
  }
  async function reconcile() {
    if (!(payer instanceof XrplPayer)) return
    await Promise.allSettled(hires.due().filter(h => !active.has(h.key)).map(async hire => {
      const release = context.work.acquire()
      try { await recover(hire) } finally { release() }
    }))
  }
  router.post('/v1/ask', async (req, res) => {
    const release = context.work.acquire()
    try {
    if (!payer?.address || !facilitator) return res.status(503).json({ error: 'Hire requires XRPL Testnet settlement' })
    const input = Input.parse(req.body)
    const callerKey = z.string().min(1).max(200).parse(req.get('Idempotency-Key'))
    const agentId: string | undefined = res.locals.agent?.id
    const key = agentId ? `${agentId}:${callerKey}` : callerKey
    let hire = hires.get(key)
    if (!hire) {
      const quoteId = randomUUID()
      const amount = String((input.budgetMinor + SERVICE_FEE_MINOR) * DROPS_PER_MINOR)
      const invoiceId = invoiceIdFor({ quoteId, articleId: key, version: 'hire-v1', manifestRoot: ledgerInvoiceId(JSON.stringify(input)), amount, payTo: payer.address })
      const quote = { invoiceId, ledgerInvoiceId: ledgerInvoiceId(invoiceId), quoteId, publisherSlug: 'researchagent', articleId: key, version: 'hire-v1', amount, payTo: payer.address, expiresAt: new Date(Date.now() + 60_000).toISOString() }
      journal.saveQuote(quote)
      hire = hires.save({ ...input, key, quote, agentId })
    }
    if (!hire.result && hire.quote.payTo !== payer.address) return res.status(409).json({ error: 'Hire receiving wallet changed; original intent requires reconciliation' })
    if (hire.question !== input.question || hire.budgetMinor !== input.budgetMinor) return res.status(409).json({ error: 'Idempotency key belongs to another request' })
    const signature = req.get('PAYMENT-SIGNATURE')
    if (!signature) return res.status(402).set('PAYMENT-REQUIRED', encodeHeader('PAYMENT-REQUIRED', { x402Version: 2,
      resource: { url: '/v1/ask', description: XRPL_LABEL, mimeType: 'application/json' }, accepts: [requirementsFor(hire.quote)] }))
      .json({ budgetMinor: input.budgetMinor, serviceFeeMinor: SERVICE_FEE_MINOR, royaltyMinor: 5, label: XRPL_LABEL })
    const decoded = decodeHeader('PAYMENT-SIGNATURE', signature)
    const verified = await facilitator.verify(decoded, { articleId: key, version: 'hire-v1' })
    if (!verified.ok || verified.quote.ledgerInvoiceId !== hire.quote.ledgerInvoiceId) return res.status(402).json({ error: 'Payment does not match hire invoice' })
    hire = hires.patch(key, { signature }) // first blob wins even if settlement is ambiguous
    if (!hire.runId) {
      const admitted = admit(store, { surface: agentId ? 'agent' : 'x402', principal: agentId ?? verified.payer, question: input.question,
        requestedMinor: input.budgetMinor, idempotencyKey: hire.quote.invoiceId, maxMinor: 500, reserveMinor: SERVICE_FEE_MINOR, labels: context.labels })
      hire = hires.patch(key, { runId: admitted.run.runId })
      // Never accept money that could not fit in the already-reserved operator cap.
      if (admitted.run.budgetMinor !== input.budgetMinor) {
        store.updateRun(admitted.run.runId, { phase: 'FAILED', stopped: true })
        store.closeHireReserve(admitted.run.runId)
        return res.status(409).json({ error: 'Hire budget unavailable under wallet cap; nothing submitted' })
      }
    }
    if (store.getRun(hire.runId!).budgetMinor !== input.budgetMinor) return res.status(409).json({ error: 'Hire admission refused' })
    if (!journal.settlementByTx(verified.txHash)) {
      if (agentId) {
        const agent = store.agentStatus(agentId)
        if (agent.paused || agent.revoked || agent.spentMinor + agent.reservedMinor > agent.dailyMinor) return res.status(409).json({ error: 'Agent admission paused or capped; nothing submitted' })
      }
      const wallet = store.walletStatus()
      if (wallet.paused || wallet.spentMinor + wallet.reservedMinor > wallet.dailyMinor) return res.status(409).json({ error: 'Hire admission paused or capped; nothing submitted' })
    }
    const settled = await facilitator.settle(decoded, { articleId: key, version: 'hire-v1' })
    res.set('PAYMENT-RESPONSE', encodeHeader('PAYMENT-RESPONSE', paymentResponse(settled)))
    if (!settled.ok) return res.status(402).json({ error: settled.reason, label: XRPL_LABEL })
    recordInbound(hire, verified.payer, verified.txHash, settled.settlement)
    if (hire.result) { store.closeHireReserve(hire.runId!); return res.json(hire.result) }
    return res.json(await resume(hire, verified.payer))
    } finally { release() }
  })
  return { router, reconcile, close: () => { hires.close(); journal.close() }, drain: () => Promise.allSettled(active.values()) }
}
