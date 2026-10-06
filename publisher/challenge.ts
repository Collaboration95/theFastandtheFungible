// POST /w/:slug/challenge (#132, D5): the writer re-runs the shared checker on the bytes and salts
// it stored. A broken claim earns a refund Payment of the full amount back to the payer, with
// InvoiceID = the original tx hash, write-once per payment and per intent. The publisher key
// signs in memory only: never logged or traced.
import { Wallet } from 'xrpl'
import type { Challenge, ChallengeResult, Rail } from '../shared/contracts/publisher.js'
import { verifyDelivery } from '../shared/manifest.js'
import { signPayment, verifyPayment, type Ledger } from '../shared/xrpl.js'
import { PublisherError, type PublisherJournal } from './journal.js'
import type { Manifests } from './manifest.js'
import type { PublisherEntry } from './registry.js'

export function createChallenges(journal: PublisherJournal, manifests: Manifests, rail: Rail, ledger?: Ledger, timing = { pollMs: 1000, timeoutMs: 20_000 }) {
  // ponytail: one refund at a time per process, so parallel challenges never race the account Sequence or the write-once row.
  let queue: Promise<unknown> = Promise.resolve()

  async function refundOnce(entry: PublisherEntry, challenge: Challenge, payer: string, amountDrops: string): Promise<string> {
    const run = queue.then(async () => {
      let refund = journal.refundByTx(challenge.txHash)
      if (!refund) {
        const wallet = new Wallet(entry.keys!.publicKey, entry.keys!.privateKey)
        const signed = await signPayment(wallet, { Destination: payer, Amount: amountDrops, InvoiceID: challenge.txHash }, rail === 'xrpl-testnet' ? ledger : undefined)
        refund = journal.saveRefund({ originalTxHash: challenge.txHash, intentId: challenge.intentId, txHash: signed.txHash, txBlob: signed.txBlob })
      }
      if (rail === 'xrpl-testnet') await submitAndWait(refund.txBlob, refund.txHash, payer, amountDrops, challenge.txHash)
      return refund.txHash
    })
    queue = run.catch(() => undefined)
    return run
  }

  /** Same blob, same hash: resubmitting is harmless. Returns once validated, or after the timeout (the buyer checks the ledger itself). */
  async function submitAndWait(blob: string, txHash: string, payTo: string, amountDrops: string, invoiceId: string) {
    const terms = { rail: 'xrpl-testnet' as const, network: 'xrpl:1' as const, asset: 'XRP' as const, payTo, amountDrops, invoiceId }
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
    const settlement = journal.settlementByTx(body.txHash)
    const quote = settlement && journal.quoteByInvoice(settlement.ledgerInvoiceId)
    const article = quote && quote.publisherSlug === entry.publisher.slug ? entry.articles.find(a => a.articleId === quote.articleId && a.version === quote.version) : undefined
    const manifest = article && manifests.manifestFor(entry, article, 0)
    if (!settlement || !quote || !article || !manifest || !entry.keys) throw new PublisherError(404, 'No settled payment for this article')
    const claim = manifest.claims.find(c => c.id === body.claimId && c.leaf === body.leaf)
    if (!claim) return { status: 'REJECTED' }
    // The shared checker on the stored bytes and salts, never on what the buyer sent.
    const broken = verifyDelivery(article.body, article.passages, manifests.saltsFor(article), manifest).failedClaims.includes(claim.id)
    if (!broken) return { status: 'REJECTED' }
    // Repeated or parallel challenges get the one stored refund back (resubmitted, never re-signed).
    return { status: 'REFUNDED', refundTxHash: await refundOnce(entry, body, settlement.payer, quote.amount) }
  }
}
