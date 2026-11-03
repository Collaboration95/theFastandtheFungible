import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { hashes } from 'xrpl'
import { PublisherJournal } from '../../publisher/journal.js'
import { Facilitator, requirementsFor, paymentResponse } from '../../publisher/facilitator.js'
import { decodeHeader, encodeHeader, invoiceIdFor, ledgerInvoiceId } from '../../shared/x402.js'
import { DROPS_PER_MINOR, XRPL_LABEL } from '../../shared/contracts/index.js'
import { verifyPayment } from '../../shared/xrpl.js'
import { presentRun } from '../../sdk/present.js'
import type { ApiContext } from '../api/context.js'
import { admit } from '../spend-policy.js'
import { payeeRefusal } from '../payee-screening.js'
import { freezeRequirements, plan as planSearch } from '../agents/scope.js'
import { SERVICE_FEE_MINOR, royaltyPlan, changePlan } from './policy.js'
import { HireJournal, type Hire } from './journal.js'

const Input = z.object({ question: z.string().trim().min(1).max(2000), budgetMinor: z.union([z.literal(100), z.literal(200), z.literal(500)]) }).strict()
/** Payment authority is a settled invoice, never a model tool. No browser/UI surface. */
export function hireService(context: ApiContext) {
  const { store, payer, loop } = context
  // Same SQLite file; isolated tables avoid purchase-manager changes.
  const journal = new PublisherJournal(store.path)
  const hires = new HireJournal(store.path)
  const facilitator = payer ? new Facilitator(journal, 'xrpl-testnet', payer.ledger) : undefined
  const active = new Map<string, Promise<unknown>>()
  const router = Router()
  async function finish(hire: Hire, principal: string) {
    const runId = hire.runId!
    let run = store.getRun(runId)
    if (!['DONE', 'STOPPED', 'FAILED'].includes(run.phase)) {
      await context.launch(runId, async () => {
        const planned = await planSearch(hire.question)
        const frozen = freezeRequirements(hire.question, planned)
        const { label, requirements: _texts, requirementsKey: _key, ...plan } = planned
        store.updateRun(runId, { labels: { ...run.labels, plan: label }, checkpoint: { ...run.checkpoint, plan, requirements: frozen.requirements, requirementsBy: frozen.source === 'plan' ? label : 'fixture · scope-fixture' } })
        store.appendEvent(runId, { type: 'PLAN', label: `Hire research plan (${label})`, data: { plan } })
        await loop.start(runId)
      })
    }
    run = store.getRun(runId)
    const registry = await context.client.registry()
    const addresses = Object.fromEntries(registry.filter(p => p.wallet).map(p => [p.slug, p.wallet!]))
    const royalties = royaltyPlan(run, addresses)
    const change = changePlan(run, hire.budgetMinor, principal)
    store.reservePolicyPayments(runId, [...royalties, ...change])
    for (const payment of store.policyPayments(runId)) {
      if (payment.confirmedAt) continue
      const refusal = payeeRefusal(payment.payTo)
      if (refusal) throw new Error(refusal)
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
        store.confirmPolicyPayment(runId, payment.id)
        store.appendEvent(runId, { type: 'XRPL', label: `${payment.kind} · ${XRPL_LABEL}`, data: { kind: payment.kind, txHash: signed.txHash, amountDrops: payment.amountDrops, payTo: payment.payTo, invoiceId: terms.invoiceId } })
      }
      if (payment.submission) await send(payment.submission)
      else {
        const paid = await payer!.pay(terms, signed => store.recordPolicySubmission(runId, payment.id, signed), send)
        await paid.sent
      }
    }
    const settled = journal.settlementByTx(hashes.hashSignedTx(decodeHeader('PAYMENT-SIGNATURE', hire.signature!).payload.signedTxBlob).toUpperCase())!
    const payments = store.policyPayments(runId).map(p => ({ id: p.id, kind: p.kind, payTo: p.payTo, amountDrops: p.amountDrops,
      txHash: p.submission!.txHash, explorerUrl: `https://testnet.xrpl.org/transactions/${p.submission!.txHash}`, label: XRPL_LABEL }))
    const royaltyDrops = royalties.reduce((s, p) => s + Number(p.amountDrops), 0)
    const changeDrops = change.reduce((s, p) => s + Number(p.amountDrops), 0)
    const result = { ...presentRun(run, context.publisherUrl), moneyChain: {
      inbound: { txHash: settled.txHash, payer: principal, payTo: payer!.address, amountDrops: hire.quote.amount, explorerUrl: `https://testnet.xrpl.org/transactions/${settled.txHash}`, label: XRPL_LABEL },
      writerAddresses: addresses, payments, purchaseDrops: String(run.spentMinor * DROPS_PER_MINOR), royaltyDrops: String(royaltyDrops), changeDrops: String(changeDrops),
      retainedDrops: String(SERVICE_FEE_MINOR * DROPS_PER_MINOR - royaltyDrops), feePolicy: 'Network fees paid separately by each sender; not deducted from caller change', policy: 'hire-v1 · 25% of fixed S$0.20 fee; equal by distinct cited writer, slug-sorted remainder' } }
    hires.patch(hire.key, { result })
    store.closeHireReserve(runId)
    return result
  }
  router.post('/v1/ask', async (req, res) => {
    if (!payer?.address || !facilitator) return res.status(503).json({ error: 'Hire requires XRPL Testnet settlement' })
    const input = Input.parse(req.body)
    const key = z.string().min(1).max(200).parse(req.get('Idempotency-Key'))
    let hire = hires.get(key)
    if (!hire) {
      const quoteId = randomUUID()
      const amount = String((input.budgetMinor + SERVICE_FEE_MINOR) * DROPS_PER_MINOR)
      const invoiceId = invoiceIdFor({ quoteId, articleId: key, version: 'hire-v1', manifestRoot: ledgerInvoiceId(JSON.stringify(input)), amount, payTo: payer.address })
      const quote = { invoiceId, ledgerInvoiceId: ledgerInvoiceId(invoiceId), quoteId, publisherSlug: 'researchagent', articleId: key, version: 'hire-v1', amount, payTo: payer.address, expiresAt: new Date(Date.now() + 60_000).toISOString() }
      journal.saveQuote(quote)
      hire = hires.save({ ...input, key, quote })
    }
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
      const admitted = admit(store, { surface: 'x402', principal: verified.payer, question: input.question,
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
    const settled = await facilitator.settle(decoded, { articleId: key, version: 'hire-v1' })
    res.set('PAYMENT-RESPONSE', encodeHeader('PAYMENT-RESPONSE', paymentResponse(settled)))
    if (!settled.ok) return res.status(402).json({ error: settled.reason, label: XRPL_LABEL })
    if (hire.result) return res.json(hire.result)
    let pending = active.get(key)
    if (!pending) {
      pending = finish(hire, verified.payer).finally(() => active.delete(key))
      active.set(key, pending)
    }
    return res.json(await pending)
  })
  return { router, close: () => { hires.close(); journal.close() }, drain: () => Promise.allSettled(active.values()) }
}
