import { checkFreshness } from './writers/ledger-analytics/freshness.js'
// POST /w/:slug/challenge (#132, D5): the writer re-runs the shared checker on the bytes and salts
// it stored. A broken claim earns a refund Payment of the full amount back to the payer, with
// InvoiceID = the original tx hash, write-once per payment and per intent. The publisher key
// signs in memory only: never logged or traced.
import { ledgerAmount, type Asset } from '../shared/contracts/asset.js'
import { escrowInvoice } from '../shared/escrow.js'
import { ledgerInvoiceId } from '../shared/x402.js'
import { Wallet, decode } from 'xrpl'
import { XrplPayer } from '../server/xrpl.js'
import type { Challenge, ChallengeResult, Rail } from '../shared/contracts/publisher.js'
import { verifyDelivery } from '../shared/manifest.js'
import { signPayment, verifyPayment, lookupTx, type Ledger } from '../shared/xrpl.js'
import { PublisherError, type PublisherJournal } from './journal.js'
import type { Manifests } from './manifest.js'
import type { PublisherEntry } from './registry.js'

export function createChallenges(journal: PublisherJournal, manifests: Manifests, rail: Rail, ledger?: Ledger, timing = { pollMs: 1000, timeoutMs: 20_000 }) {
  // ponytail: one refund at a time per process, so parallel challenges never race the account Sequence or the write-once row.
  let queue: Promise<unknown> = Promise.resolve()

  async function refundOnce(entry: PublisherEntry, challenge: Challenge, payer: string, amountDrops: string, asset: Asset = 'XRP'): Promise<string> {
    const run = queue.then(async () => {
      let refund = journal.refundByTx(challenge.txHash)
      const wallet = new Wallet(entry.keys!.publicKey, entry.keys!.privateKey)
      const signer = rail === 'xrpl-testnet' ? new XrplPayer(ledger!, wallet, timing) : undefined
      if (signer) signer.restorePending(journal.pendingSignatures(signer.address!))
      let replaceHash: string | undefined
      if (refund && signer) {
        const status = await signer.status({ ...refund, lastLedgerSequence: Number(decode(refund.txBlob).LastLedgerSequence) })
        if (status.state === 'failed' || status.state === 'expired') { replaceHash = refund.txHash; refund = undefined }
      }
      if (!refund) {
        if (signer) {
          const signed = await signer.refund({Destination:payer,Amount:ledgerAmount(amountDrops,asset),InvoiceID:challenge.txHash},
            s => { const saved = journal.saveRefund({ originalTxHash: challenge.txHash, intentId: challenge.intentId, ...s }, replaceHash); return {...saved, lastLedgerSequence:Number(decode(saved.txBlob).LastLedgerSequence)} },
            s => ledger!.request({command:'submit',tx_blob:s.txBlob}))
          await signed.sent
          refund = journal.refundByTx(challenge.txHash)!
        } else {
          const signed = await signPayment(wallet, { Destination: payer, Amount: amountDrops, InvoiceID: challenge.txHash })
          refund = journal.saveRefund({ originalTxHash: challenge.txHash, intentId: challenge.intentId, txHash: signed.txHash, txBlob: signed.txBlob })
        }
      }
      if (rail === 'xrpl-testnet') await submitAndWait(refund.txBlob, refund.txHash, payer, amountDrops, challenge.txHash, asset)
      return refund.txHash
    })
    queue = run.catch(() => undefined)
    return run
  }

  /** Same blob, same hash: resubmitting is harmless. Returns once validated, or after the timeout (the buyer checks the ledger itself). */
  async function submitAndWait(blob: string, txHash: string, payTo: string, amountDrops: string, invoiceId: string, asset: Asset) {
    const terms = { rail: 'xrpl-testnet' as const, network: 'xrpl:1' as const, asset, payTo, amountDrops, invoiceId }
    if ((await verifyPayment(ledger!, txHash, terms)).state === 'ok') return
    try { await ledger!.request({ command: 'submit', tx_blob: blob }) } catch { /* the lookup decides */ }
    const deadline = Date.now() + timing.timeoutMs
    for (;;) {
      const verdict = await verifyPayment(ledger!, txHash, terms).catch(() => ({ state: 'pending' as const }))
      if (verdict.state === 'ok') return
      if (verdict.state === 'invalid') throw new PublisherError(502, `Refund not accepted on the ledger: ${verdict.reason}`)
      if (Date.now() > deadline) return
      await new Promise(resolve => setTimeout(resolve, timing.pollMs))
    }
  }

  return async function challenge(entry: PublisherEntry, body: Challenge): Promise<ChallengeResult> {
    // EscrowFinish is independently validated before it can authorize a refund Payment.
    const escrow = journal.revealQuoteByFinish(body.txHash)
    if (escrow && !journal.settlementByTx(body.txHash)) {
      const t = escrow.terms, found = ledger && await lookupTx(ledger, body.txHash)
      if (t.intentId !== body.intentId || t.publisherSlug !== entry.publisher.slug || !found || found.state !== 'validated' || found.meta.TransactionResult !== 'tesSUCCESS' || found.tx.TransactionType !== 'EscrowFinish' || found.tx.Owner !== t.payer || found.tx.Condition !== t.condition) throw new PublisherError(404, 'No validated escrow finish')
      const invoice = escrowInvoice(t), id = ledgerInvoiceId(invoice)
      if (!journal.quoteByInvoice(id)) journal.saveQuote({ invoiceId: invoice, ledgerInvoiceId: id, quoteId: t.quoteId, publisherSlug: t.publisherSlug, articleId: t.articleId, version: t.version, amount: t.amount, payTo: t.payTo, asset: t.asset, expiresAt: new Date().toISOString() })
      journal.settle({ txHash: body.txHash, ledgerInvoiceId: id, payer: t.payer, ledgerIndex: found.ledgerIndex, settledAt: new Date().toISOString() })
    }
    const settlement = journal.settlementByTx(body.txHash)
    const quote = settlement && journal.quoteByInvoice(settlement.ledgerInvoiceId)
    const article = quote && quote.publisherSlug === entry.publisher.slug ? entry.articles.find(a => a.articleId === quote.articleId && a.version === quote.version) : undefined
    const manifest = article && manifests.manifestFor(entry, article, 0)
    if (!settlement || !quote || !article || !manifest || !entry.keys) throw new PublisherError(404, 'No settled payment for this article')
    const claim = manifest.claims.find(c => c.id === body.claimId && c.leaf === body.leaf)
    if (!claim) return { status: 'REJECTED' }
    // The shared checker on the stored bytes and salts, never on what the buyer sent.
    const freshness = await checkFreshness(article.body, manifest, settlement.settledAt, undefined, settlement.ledgerIndex)
    const broken = (!freshness.ok && freshness.failedClaimId === claim.id) || verifyDelivery(article.body, article.passages, manifests.saltsFor(article), manifest).failedClaims.includes(claim.id)
    if (!broken) return { status: 'REJECTED' }
    // Repeated or parallel challenges get the one stored refund back (resubmitted, never re-signed).
    return { status: 'REFUNDED', refundTxHash: await refundOnce(entry, body, settlement.payer, quote.amount, quote.asset) }
  }
}
