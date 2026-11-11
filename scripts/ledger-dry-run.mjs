// Public read-only evidence: no wallet, signing, submission or environment secrets.
import { Client } from 'xrpl'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const directory = new URL('../docs/evidence/dry-run-nov12/', import.meta.url)
const features = ['Credentials', 'DID', 'PermissionedDomains', 'TokenEscrow', 'MPTokensV1', 'Batch']
const currency = '524C555344000000000000000000000000000000'
// Public synthetic preimage: never a delivery key. The dummy finish cannot release funds.
const preimage = Buffer.alloc(32, 1)
const condition = `A0258020${createHash('sha256').update(preimage).digest('hex').toUpperCase()}810120`
const fulfillment = `A0228020${preimage.toString('hex').toUpperCase()}`
const networks = [
  { name: 'Testnet', url: 'wss://s.altnet.rippletest.net:51233', issuer: 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV', account: 'rshm7hcbFpKiYMKWzhCxmGUi8pd4Bf8Ppn', destination: 'rJDwaPFKQv45eQRxbRPpkCUZGvHMEtwPcg' },
  { name: 'Mainnet', url: 'wss://s1.ripple.com', issuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De', account: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', destination: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De' },
]
const results = []
for (const network of networks) {
  const client = new Client(network.url, { timeout: 20000 })
  const reads = []
  const request = async params => {
    const { result } = await client.request(params)
    reads.push({ request: params, result })
    return result
  }
  try {
    await client.connect()
    await request({ command: 'server_info' })
    const header = await request({ command: 'ledger', ledger_index: 'validated' })
    const amendments = await request({ command: 'feature' })
    const issuer = await request({ command: 'account_info', account: network.issuer, ledger_index: 'validated' })
    // Confirm destination exists, including on Mainnet. No Mainnet signer exists in this script.
    await request({ command: 'account_info', account: network.destination, ledger_index: 'validated' })
    const base = { TransactionType: 'EscrowCreate', Account: network.account, Destination: network.destination, Condition: condition, CancelAfter: Number(header.ledger.close_time) + 3600 }
    const rlusd = await request({ command: 'simulate', tx_json: { ...base, Amount: { currency, issuer: network.issuer, value: '0.01' } } })
    const entry = { network: network.name, endpoint: network.url, flags: issuer.account_data.Flags, issuerLedger: issuer.ledger_index, features: Object.fromEntries(features.map(name => [name, Object.values(amendments.features).find(f => f.name === name) ?? { listed: false }])), rlusd, reads }
    if (network.name === 'Testnet') {
      entry.control = await request({ command: 'simulate', tx_json: { ...base, Amount: { currency: 'SGT', issuer: 'rhto8NT62NUYYXUUuHzwLNq3A78eaNwUwx', value: '0.01' } } })
      entry.finish = await request({ command: 'simulate', tx_json: { TransactionType: 'EscrowFinish', Account: network.destination, Owner: network.account, OfferSequence: 1, Condition: condition, Fulfillment: fulfillment } })
    }
    results.push(entry)
  } finally { await client.disconnect() }
}
await mkdir(directory, { recursive: true })
await writeFile(new URL('result.json', directory), JSON.stringify({ observedAt: new Date().toISOString(), unsigned: true, submitted: false, results }, null, 2) + '\n')
const rows = results.flatMap(r => [['RLUSD', r.rlusd], ...(r.control ? [['TEST-SGD control', r.control], ['Dummy finish fee', r.finish]] : [])].map(([name, v]) => `| ${r.network} | ${name} | ${v.engine_result} | ${v.tx_json?.Fee} | ${v.ledger_index} |`))
await writeFile(new URL('README.md', directory), `# Unsigned ledger dry runs · ${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', dateStyle: 'long' }).format(new Date())}\n\nRun \`node scripts/ledger-dry-run.mjs\` (or repro 01 with \`--live\`). Public RPC only; nothing signed or submitted, no fees paid. Mainnet is read-only. TEST-SGD is our no-value Testnet stand-in for RLUSD.\n\n| Network | Transaction | Verdict | Autofilled fee (drops) | Ledger index |\n|---|---|---|---:|---:|\n${rows.join('\n')}\n\nThe Testnet creates use the same source, destination, value, deadline and condition; only currency/issuer change. The dummy finish tests fee autofill, not successful delivery: OfferSequence 1 names no escrow. Its 36-byte synthetic fulfillment is public test data.\n\nWe retain the signing fees: buyer 12 drops to lock; writer 423 to reveal (xrpl.js fractional formula and 1.2× cushion). rippled autofills 350 for the finish. A simulation is a ledger-state snapshot, not a guarantee of later submission.\n\n[Raw requests and responses](result.json), including amendment status, issuer flags and ledger indexes. [Official simulate API](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/transaction-methods/simulate).\n`)
for (const r of results) console.log(`${r.network} · issuer flags ${r.flags} · issuer ledger ${r.issuerLedger} · features ${JSON.stringify(r.features)}`)
console.log('| Network | Transaction | Verdict | Fee | Ledger |\n|---|---|---|---:|---:|\n' + rows.join('\n'))
for (const r of results) {
  assert.equal(r.rlusd.engine_result, 'tecNO_PERMISSION')
  assert.ok(r.rlusd.ledger_index > 0)
  assert.equal(r.flags, 2174353408)
  if (r.control) {
    assert.equal(r.control.engine_result, 'tesSUCCESS')
    assert.equal(r.finish.tx_json.Fee, '350')
    assert.ok(r.control.ledger_index > 0 && r.finish.ledger_index > 0)
  }
}
