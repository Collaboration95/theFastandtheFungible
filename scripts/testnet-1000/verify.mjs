// Independent verifier: Node built-ins and xrpl transport only. No product imports.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Client } from 'xrpl'

const digest = hex => createHash('sha256').update(Buffer.from(hex, 'hex')).digest('hex').toUpperCase()
const hashPattern = /^[A-F0-9]{64}$/
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
export function checkPair(r, create, finish) {
  const errors = []
  const check = (ok, reason) => { if (!ok) errors.push(reason) }
  for (const [name, result, hash, ledger] of [['create', create, r.createHash, r.createLedger], ['finish', finish, r.finishHash, r.finishLedger]]) {
    check(result?.validated === true, name + ': not validated')
    check(result?.meta?.TransactionResult === 'tesSUCCESS', name + ': not tesSUCCESS')
    check(result?.hash === hash, name + ': hash mismatch')
    check(result?.ledger_index === ledger, name + ': ledger mismatch')
  }
  const c = create?.tx_json ?? create ?? {}, f = finish?.tx_json ?? finish ?? {}
  check(c.TransactionType === 'EscrowCreate' && f.TransactionType === 'EscrowFinish', 'transaction types')
  check(c.Account === r.payer && c.Destination === r.payee, 'payer/destination')
  check(f.Account === r.payee, 'writer finish signer')
  check(r.asset === 'XRP' && typeof c.Amount === 'string' && c.Amount === r.amountDrops, 'amount/asset')
  check(Number.isSafeInteger(r.priceMinor) && r.priceMinor > 0 && r.priceCurrency === 'SGD' && BigInt(r.priceMinor ?? 0) * 1000n === BigInt(r.amountDrops ?? 0), 'minor-unit conversion')
  check(Number.isSafeInteger(r.createSequence) && c.Sequence === r.createSequence && f.OfferSequence === c.Sequence && f.Owner === c.Account, 'escrow owner/sequence')
  check(c.Condition === r.condition && f.Condition === c.Condition, 'condition binding')
  try {
    const memo = c.Memos.find(m => Buffer.from(m.Memo.MemoType, 'hex').toString() === 'researchagent/escrow-v1')
    const terms = JSON.parse(Buffer.from(memo.Memo.MemoData, 'hex').toString())
    check(terms.intentId === r.intentId && terms.articleId === r.resourceId && terms.payer === r.payer && terms.payTo === r.payee && terms.amount === r.amountDrops && terms.asset === r.asset && terms.condition === r.condition, 'ledger memo intent/resource binding')
  } catch { errors.push('missing/invalid escrow intent memo') }
  const fulfillment = String(f.Fulfillment ?? '').toUpperCase()
  const validFulfillment = /^A0228020[A-F0-9]{64}$/.test(fulfillment)
  const match = validFulfillment && c.Condition === `A0258020${digest(fulfillment.slice(8))}810120`
  check(match && r.fulfillmentHashMatch === true, 'PREIMAGE-SHA-256 mismatch')
  check(validFulfillment && digest(fulfillment) === r.fulfillmentSha256, 'fulfillment digest')
  check(finish?.ledger_index >= create?.ledger_index, 'ledger ordering')
  check(Number.isSafeInteger(r.grantSeq) && Number.isSafeInteger(r.firstReadPaidSeq) && r.grantSeq < r.firstReadPaidSeq && Number.isFinite(Date.parse(r.grantAt)) && Date.parse(r.grantAt) <= Date.parse(r.firstReadPaidAt), 'local grant/read ordering')
  for (const key of ['createMs', 'finishMs', 'endToEndMs', 'retries']) check(Number.isFinite(r[key]) && r[key] >= 0, 'invalid ' + key)
  return errors
}
export async function verify(receipts, request, progress = () => {}) {
  const errors = [], intents = new Map(), hashes = new Set(), objects = new Set()
  let verified = 0, ledgerSpent = 0n, receiptSpent = 0n, fees = 0n
  for (const r of receipts) {
    if (!r.intentId || r.schemaVersion !== 1 || r.network !== 'xrpl-testnet') errors.push({ intentId: r.intentId, errors: ['receipt schema/network'] })
    if (intents.has(r.intentId)) errors.push({ intentId: r.intentId, errors: [intents.get(r.intentId) !== r.createHash ? 'two EscrowCreates for one intent' : 'duplicate intent'] })
    intents.set(r.intentId, r.createHash)
    for (const hash of [r.createHash, r.finishHash]) { if (!hashPattern.test(hash) || hashes.has(hash)) errors.push({ intentId: r.intentId, errors: ['missing/duplicate transaction hash'] }); hashes.add(hash) }
    const object = `${r.payer}:${r.createSequence}`
    if (objects.has(object)) errors.push({ intentId: r.intentId, errors: ['duplicate escrow object'] })
    objects.add(object)
    if (r.outcome !== 'success') errors.push({ intentId: r.intentId, errors: ['purchase outcome: ' + r.outcome] })
    if (/^[1-9][0-9]*$/.test(r.amountDrops)) receiptSpent += BigInt(r.amountDrops)
    else errors.push({ intentId: r.intentId, errors: ['invalid amount'] })
  }
  let cursor = 0
  // Four workers, at most four tx requests in flight on the one public node.
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const index = cursor++; if (index >= receipts.length) return
      const r = receipts[index]
      try {
        // Always fetch both, even if a previous local receipt check failed.
        const c = await request(r.createHash), f = await request(r.finishHash)
        let pairErrors
        try { pairErrors = checkPair(r, c, f) } catch { pairErrors = ['malformed receipt/transaction'] }
        if (pairErrors.length) errors.push({ intentId: r.intentId, errors: pairErrors })
        else verified++
        const tx = c.tx_json ?? c
        if (c.validated && c.meta?.TransactionResult === 'tesSUCCESS' && /^[0-9]+$/.test(tx.Amount)) ledgerSpent += BigInt(tx.Amount)
        fees += BigInt(tx.Fee ?? 0) + BigInt((f.tx_json ?? f).Fee ?? 0)
      } catch { errors.push({ intentId: r.intentId, errors: ['public tx lookup unavailable'] }) }
      progress(index + 1)
    }
  }))
  if (ledgerSpent !== receiptSpent) errors.push({ errors: ['ledger total differs from sum of receipts'] })
  if (!receipts.length) errors.push({ errors: ['empty evidence'] })
  return { network: 'xrpl-testnet', checkedAt: new Date().toISOString(), receipts: receipts.length, verified, mismatches: errors.length, totalSpentDrops: ledgerSpent.toString(), receiptTotalDrops: receiptSpent.toString(), transactionFeesDrops: fees.toString(), success: errors.length === 0, scope: 'Every listed transaction re-fetched; intent uniqueness within this complete receipt file. Local grant/read times are runner observations, not independently attested by XRPL.', errors }
}

export async function checkHistory(receipts, request, ledgerMax) {
  const expected = new Map(receipts.map(r => [r.createHash, r.intentId])), found = new Map(), errors = []
  const min = Math.min(...receipts.map(r => r.createLedger))
  for (const account of new Set(receipts.map(r => r.payer))) {
    let marker
    do {
      const result = await request({ command: 'account_tx', api_version: 2, account, ledger_index_min: min, ledger_index_max: ledgerMax, binary: false, forward: true, limit: 200, ...(marker ? { marker } : {}) })
      if (!Array.isArray(result.transactions)) throw Error('Incomplete account history')
      for (const row of result.transactions) {
        const tx = row.tx_json ?? row.tx
        if (tx?.Account !== account || tx?.TransactionType !== 'EscrowCreate') continue
        const hash = row.hash ?? tx.hash
        if (!row.validated || row.meta?.TransactionResult !== 'tesSUCCESS') continue
        if (!expected.has(hash)) errors.push('Unreceipted validated EscrowCreate: ' + hash)
        let id
        try { const memo = tx.Memos.find(m => Buffer.from(m.Memo.MemoType, 'hex').toString() === 'researchagent/escrow-v1'); id = JSON.parse(Buffer.from(memo.Memo.MemoData, 'hex').toString()).intentId } catch { errors.push('Missing intent in account history: ' + hash); continue }
        if (found.has(id) && found.get(id) !== hash) errors.push('Two validated EscrowCreates for intent: ' + id)
        found.set(id, hash)
      }
      marker = result.marker
    } while (marker)
  }
  for (const [hash, id] of expected) if (found.get(id) !== hash) errors.push('Receipt missing from account history: ' + hash)
  return { accounts: new Set(receipts.map(r => r.payer)).size, ledgerMin: min, ledgerMax, creates: found.size, errors }
}

async function main() {
  const args = process.argv.slice(2)
  const node = args.includes('--node') ? args[args.indexOf('--node') + 1] : 'wss://s.altnet.rippletest.net:51233'
  if (!/^wss:\/\/[a-z0-9.-]+\.rippletest\.net(?::\d+)?\/?$/.test(node)) throw Error('Public Testnet node required')
  const file = args.includes('--receipts') ? args[args.indexOf('--receipts') + 1] : 'data/evidence/testnet-1000/receipts.jsonl'
  const output = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'docs/evidence/proof/testnet-1000-verify.json'
  const bytes = readFileSync(file)
  if (bytes.length > 2000000 || !bytes.toString().endsWith('\n')) throw Error('Receipt file must be complete JSONL below 2 MB')
  const receipts = bytes.toString().trim().split('\n').map(line => JSON.parse(line))
  const client = new Client(node, { timeout: 20000, connectionTimeout: 15000 })
  let rpcRetries = 0
  try {
    await client.connect()
    if (Number((await client.request({ command: 'server_info' })).result.info.network_id) !== 1) throw Error('Node did not confirm Testnet')
    const request = async command => {
      for (let i = 0; ; i++) {
        try { if (!client.isConnected()) await client.connect(); return (await client.request(command)).result }
        catch { if (i >= 5) throw Error('Lookup failed'); rpcRetries++; await wait(Math.min(30000, 1000 * 2 ** i)) }
      }
    }
    const result = await verify(receipts, hash => request({ command: 'tx', transaction: hash, api_version: 2 }), n => { if (n % 100 === 0) console.error(`Re-fetched ${n}/${receipts.length} pairs`) })
    const ledgerMax = Number((await request({ command: 'ledger', ledger_index: 'validated' })).ledger_index)
    result.accountHistory = await checkHistory(receipts, request, ledgerMax)
    result.errors.push(...result.accountHistory.errors.map(error => ({ errors: [error] })))
    result.mismatches = result.errors.length; result.success = result.mismatches === 0
    result.scope = 'Every listed transaction re-fetched. All successful EscrowCreates for these fresh payer accounts scanned over the recorded ledger interval to detect omitted or duplicate charges. Grant/read times remain local observations.'
    Object.assign(result, { publicNode: node, rpcRetries, receiptsSha256: createHash('sha256').update(bytes).digest('hex') })
    mkdirSync(dirname(resolve(output)), { recursive: true }); writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
    console.table([{ receipts: result.receipts, verified: result.verified, mismatches: result.mismatches, spentXrp: Number(result.totalSpentDrops) / 1e6, feesXrp: Number(result.transactionFeesDrops) / 1e6, rpcRetries }])
    if (!result.success) process.exitCode = 1
  } finally { await client.disconnect() }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => { console.error('Verification failed; no success claimed'); process.exitCode = 1 })
