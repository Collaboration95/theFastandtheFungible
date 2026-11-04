// Cost and latency card from live XRPL Testnet runs. Input is sanitized transaction metadata
// (docs/evidence/round3-a/probe.json), never a wallet cache. Offline; no network, no secrets.
//   node scripts/testnet-cost-card.mjs [probe.json] [--xrp-sgd 2.00] [--markdown]
import { readFileSync } from 'node:fs'
const args = process.argv.slice(2)
const flag = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1] }
const path = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--xrp-sgd') || 'docs/evidence/round3-a/probe.json'
const { timings } = JSON.parse(readFileSync(path, 'utf8'))
const rate = flag('--xrp-sgd') === undefined ? undefined : Number(flag('--xrp-sgd'))
if (rate !== undefined && !(Number.isFinite(rate) && rate > 0)) throw Error('--xrp-sgd must be a positive number')
const fees = {}
for (const run of timings) for (const tx of run.transactions) (fees[tx.type] ??= []).push(tx.feeDrops)
const mean = type => { const v = fees[type]; if (!v?.length) throw Error(`No ${type} in ${path}`); return v.reduce((a, b) => a + b, 0) / v.length }
const round1 = n => Math.round(n * 10) / 10
const create = mean('EscrowCreate'), finish = mean('EscrowFinish'), anchor = mean('AccountSet')
// Plain Payment and writer-signed refund fees were observed at 12 drops in docs/evidence/numbers-v7-testnet.md.
const REFERENCE = { plainPayment: 12, refundPayment: 12, source: 'docs/evidence/numbers-v7-testnet.md (observed live Testnet runs)' }
const first = timings[0], rest = timings.slice(1)
const card = {
  label: 'Observed on XRPL Testnet · no real value · fixture models and fictional writers',
  feesDrops: { escrowCreate: create, escrowFinish: finish, keyRevealPurchase: create + finish, anchor, ...REFERENCE },
  latencySeconds: {
    initialize: round1(first.initializeSeconds),
    coldWalletProvisioning: round1(first.fundedSeconds),
    cachedWalletProvisioning: rest.length ? round1(Math.max(...rest.map(t => t.fundedSeconds))) : null,
    purchaseAnchored: round1(Math.max(...timings.map(t => t.purchaseSeconds))),
  },
  runs: timings.length,
  ...(rate === undefined ? {} : { projection: {
    label: 'PROJECTION, not a measurement: Testnet fees can differ from mainnet fees under load; excludes principal, the 0.2 XRP escrow owner reserve (held, then released) and model costs',
    xrpSgdRate: rate, rateNote: 'assumed round figure, not a market quote; change with --xrp-sgd',
    keyRevealPurchaseSgd: (create + finish) / 1e6 * rate, anchorSgd: anchor / 1e6 * rate,
  } }),
}
if (args.includes('--markdown')) {
  const f = card.feesDrops, l = card.latencySeconds, p = card.projection
  console.log(`| Key-reveal purchase (EscrowCreate + EscrowFinish) | ${f.keyRevealPurchase} drops (${f.escrowCreate} + ${f.escrowFinish}) |
| Answer anchor (AccountSet) | ${f.anchor} drops |
| Plain payment / writer-signed refund | ${f.plainPayment} / ${f.refundPayment} drops (earlier runs) |
| MCP initialize · cold wallet provisioning · cached wallets | ${l.initialize} s · ${l.coldWalletProvisioning} s · ${l.cachedWalletProvisioning ?? 'n/a'} s |
| Anchored key-reveal answer, end to end (slowest of ${card.runs} runs) | ${l.purchaseAnchored} s |${p ? `
| **Projection** at an assumed S$${p.xrpSgdRate.toFixed(2)} per XRP | S$${p.keyRevealPurchaseSgd.toFixed(5)} per purchase, S$${p.anchorSgd.toFixed(5)} per anchor (fees only) |` : ''}`)
} else console.log(JSON.stringify(card, null, 2))
