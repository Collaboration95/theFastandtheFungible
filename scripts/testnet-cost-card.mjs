import { readFileSync } from 'node:fs'
// Input is sanitized live tx metadata, not seeds or a private wallet cache.
const path = process.argv[2] || 'docs/evidence/round3-a/probe.json'
let input = JSON.parse(readFileSync(path, 'utf8'))
// A receipts.json export can be measured independently from Testnet as well.
if (input.payments && !input.timings) {
  if (process.env.RA_ACCEPT_TESTNET !== '1') throw Error('Receipt fee lookup requires RA_ACCEPT_TESTNET=1')
  const hashes = [...new Set(input.payments.flatMap(p => [p.escrowCreateHash, p.txHash, p.refundTxHash]).concat(input.ledgerAnchor?.txHash).filter(Boolean))]
  const transactions = []
  for (const hash of hashes) {
    if (!/^[A-F0-9]{64}$/i.test(hash)) throw Error('Invalid receipt transaction hash')
    const response = await fetch('https://s.altnet.rippletest.net:51234/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'tx', params: [{ transaction: hash }] }), signal: AbortSignal.timeout(15000) })
    const { result } = await response.json()
    if (!result.validated || result.meta.TransactionResult !== 'tesSUCCESS') throw Error('Receipt transaction is not validated successful Testnet evidence')
    const tx = result.tx_json ?? result
    transactions.push({ hash, type: tx.TransactionType, feeDrops: Number(tx.Fee) })
  }
  input = { timings: [{ transactions }] }
}
const rateIndex = process.argv.indexOf('--xrp-sgd')
const rate = rateIndex < 0 ? undefined : Number(process.argv[rateIndex + 1])
if (rate !== undefined && !(Number.isFinite(rate) && rate > 0)) throw Error('Positive XRP/SGD projection rate required')
const fees = {}
for (const run of input.timings) for (const tx of run.transactions) (fees[tx.type] ??= []).push(tx.feeDrops)
const average = type => fees[type]?.reduce((a, b) => a + b, 0) / fees[type]?.length || 0
const keyRevealDrops = average('EscrowCreate') + average('EscrowFinish')
console.log(JSON.stringify({ label: 'Observed XRPL Testnet · no real value', feesDrops: { keyReveal: keyRevealDrops, create: average('EscrowCreate'), finish: average('EscrowFinish'), anchorPayment: average('Payment'), plainPaymentReference: 12, refundPaymentReference: 12 }, timings: input.timings.map(({ attempt, initializeSeconds, fundedSeconds, purchaseSeconds }) => ({ attempt, initializeSeconds, fundedSeconds, purchaseSeconds })), ...(rate === undefined ? {} : { projection: { label: 'Mainnet projection; fees can change; excludes reserves, principal and model costs', xrpSgdRate: rate, keyRevealSgd: keyRevealDrops / 1e6 * rate } }) }, null, 2))
