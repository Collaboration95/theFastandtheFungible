// XRPL TESTNET ONLY; faucet XRP and synthetic content. No environment wallets.
import assert from 'node:assert/strict'
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { Client, decode, hashes } from 'xrpl'
import { encodePaymentRequiredHeader, decodePaymentRequiredHeader, decodePaymentSignatureHeader,
  buildPaymentSignatureHeaderForSignedBlob, jsonCanonicalStringify } from 'x402-xrpl'

const TESTNET = 'wss://s.altnet.rippletest.net:51233'
const hex = b => b.toString('hex').toUpperCase()
const bytes = h => Buffer.from(h, 'hex')
const sha = b => hex(createHash('sha256').update(b).digest())
export const conditionFor = key => `A0258020${sha(key)}810120` // DER, cost = 32
const commitment = offer => sha(jsonCanonicalStringify(offer))
const txJSON = r => r.tx_json ?? r
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

export function seal(content) {
  const key = randomBytes(32), iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(content), cipher.final()])
  return { key, envelope: { ciphertext: hex(encrypted), iv: hex(iv), tag: hex(cipher.getAuthTag()),
    plaintextHash: sha(content) } }
}
export function open(envelope, finish, onLedgerCondition) {
  assert.match(finish.Fulfillment, /^A0228020[A-F0-9]{64}$/)
  const key = bytes(finish.Fulfillment.slice(8))
  assert.equal(conditionFor(key), onLedgerCondition, 'sha256(K) must match ledger Condition')
  assert.equal(finish.Condition, onLedgerCondition)
  const decipher = createDecipheriv('aes-256-gcm', key, bytes(envelope.iv))
  decipher.setAuthTag(bytes(envelope.tag))
  const plaintext = Buffer.concat([decipher.update(bytes(envelope.ciphertext)), decipher.final()])
  assert.equal(sha(plaintext), envelope.plaintextHash)
  return plaintext.toString('utf8')
}
export function checkOffer(req, seller, buyer, now) {
  assert.equal(req.scheme, 'key-reveal-escrow'); assert.equal(req.network, 'xrpl:1')
  assert.equal(req.asset, 'XRP'); assert.equal(req.payTo, seller)
  assert.equal(req.amount, '1000', 'fixed per-intent policy budget: 1000 drops')
  assert.equal(req.extra.buyer, buyer)
  assert.match(req.extra.condition, /^A0258020[A-F0-9]{64}810120$/)
  assert.ok(Number.isInteger(req.extra.cancelAfter) && req.extra.cancelAfter > now + 8)
  assert.ok(req.extra.cancelAfter <= now + 65, 'bounded lock lifetime')
}
export function checkCreate(tx, offer) {
  const req = offer.accepts[0], e = req.extra
  assert.equal(tx.TransactionType, 'EscrowCreate'); assert.equal(tx.Account, e.buyer)
  assert.equal(tx.Destination, req.payTo); assert.equal(tx.Amount, req.amount)
  assert.equal(tx.Condition, e.condition); assert.equal(tx.CancelAfter, e.cancelAfter)
  assert.equal(tx.FinishAfter, undefined)
  assert.deepEqual(tx.Memos, [{ Memo: { MemoData: commitment(offer) } }])
}
function validated(r) {
  assert.equal(r.validated, true); assert.equal(r.meta.TransactionResult, 'tesSUCCESS')
  return r
}
async function submit(client, wallet, tx) {
  const prepared = await client.autofill(tx)
  assert.ok(BigInt(prepared.Fee) <= 1000n, 'per-transaction fee cap: 1000 drops')
  const signed = wallet.sign(prepared) // Sign once. Never re-sign after an uncertain submit.
  const result = validated((await client.submitAndWait(signed.tx_blob)).result)
  return { result, blob: signed.tx_blob, hash: signed.hash }
}
async function ledgerTime(client) {
  return (await client.request({ command: 'ledger', ledger_index: 'validated' })).result.ledger.close_time
}
async function escrow(client, buyer, sequence) {
  return (await client.request({ command: 'ledger_entry', ledger_index: 'validated',
    escrow: { owner: buyer, seq: sequence } })).result.node
}

export async function run({ log = console.log } = {}) {
  assert.equal(process.env.XRPL_KEY_REVEAL_TESTNET, '1', 'Opt in with XRPL_KEY_REVEAL_TESTNET=1')
  const client = new Client(TESTNET, { connectionTimeout: 15000, timeout: 15000 })
  let server
  const receipts = []
  function record(label, payment) {
    receipts.push({ label, hash: payment.hash, ledger: payment.result.ledger_index,
      fee: txJSON(payment.result).Fee })
    log(`${label}: https://testnet.xrpl.org/transactions/${payment.hash}`)
  }
  try {
    await client.connect()
    assert.equal((await client.request({ command: 'server_info' })).result.info.network_id, 1)
    log('XRPL TESTNET · faucet XRP · synthetic content · no real value')
    const { wallet: buyer } = await client.fundWallet()
    const { wallet: seller } = await client.fundWallet()
    const offers = new Map()
    server = createServer(async (request, response) => {
      const reply = (status, body, headers = {}) => {
        response.writeHead(status, { 'content-type': 'application/json', ...headers })
        response.end(JSON.stringify(body))
      }
      try {
        const url = new URL(request.url, 'http://localhost'), intent = url.searchParams.get('intent')
        assert.equal(request.method, 'GET'); assert.equal(url.pathname, '/article')
        assert.ok(['deliver', 'withhold'].includes(intent))
        if (!offers.has(intent)) {
          const { key, envelope } = seal(Buffer.from('Synthetic article: keys travel on XRPL.'))
          const offer = { x402Version: 2, resource: { url: `http://127.0.0.1:${server.address().port}${request.url}` },
            accepts: [{ scheme: 'key-reveal-escrow', network: 'xrpl:1',
            asset: 'XRP', amount: '1000', payTo: seller.classicAddress, maxTimeoutSeconds: 60,
            extra: { invoiceId: randomUUID(), buyer: buyer.classicAddress, condition: conditionFor(key),
              cancelAfter: await ledgerTime(client) + (intent === 'withhold' ? 24 : 60) } }],
          extensions: { keyReveal: envelope } }
          offers.set(intent, { key, offer }) // One offer and one create per intent, in memory.
        }
        const state = offers.get(intent), req = state.offer.accepts[0]
        const header = request.headers['payment-signature']
        if (!header) return reply(402, state.offer, { 'PAYMENT-REQUIRED': encodePaymentRequiredHeader(state.offer) })
        const payment = decodePaymentSignatureHeader(header), blob = payment.payload.signedTxBlob
        assert.deepEqual(payment.accepted, req)
        const hash = hashes.hashSignedTx(blob), tx = decode(blob)
        checkCreate(tx, state.offer)
        const create = validated((await client.request({ command: 'tx', transaction: hash })).result)
        assert.equal(create.hash, hash); checkCreate(txJSON(create), state.offer)
        if (state.createHash) assert.equal(hash, state.createHash, 'no replacement create')
        state.createHash = hash
        if (intent === 'withhold') return reply(202, { status: 'seller deliberately withholds key' })
        if (!state.finish) {
          const node = await escrow(client, buyer.classicAddress, tx.Sequence)
          for (const field of ['Account', 'Destination', 'Amount', 'Condition', 'CancelAfter']) assert.equal(node[field], tx[field])
          state.finish ??= submit(client, seller, { TransactionType: 'EscrowFinish', Account: seller.classicAddress,
            Owner: buyer.classicAddress, OfferSequence: tx.Sequence, Condition: node.Condition,
            Fulfillment: `A0228020${hex(state.key)}` })
        }
        const finish = await state.finish
        return reply(200, { finishHash: finish.hash }) // Key never travels over HTTP.
      } catch { reply(400, { error: 'Escrow offer or validated transaction rejected' }) }
    })
    server.listen(0, '127.0.0.1') // Ephemeral: compatible with any lane OFFSET.
    await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}/article`
    async function buy(intent) {
      const url = `${base}?intent=${intent}`, unpaid = await fetch(url)
      assert.equal(unpaid.status, 402)
      const offer = decodePaymentRequiredHeader(unpaid.headers.get('PAYMENT-REQUIRED'))
      assert.equal(commitment(offer), commitment(await unpaid.json())) // Same header and body; ciphertext only.
      const req = offer.accepts[0], e = req.extra
      checkOffer(req, seller.classicAddress, buyer.classicAddress, await ledgerTime(client))
      const create = await submit(client, buyer, { TransactionType: 'EscrowCreate', Account: buyer.classicAddress,
        Destination: req.payTo, Amount: req.amount, Condition: e.condition, CancelAfter: e.cancelAfter,
        Memos: [{ Memo: { MemoData: commitment(offer) } }] })
      record(`${intent} create`, create)
      const sequence = txJSON(create.result).Sequence
      const node = await escrow(client, buyer.classicAddress, sequence)
      assert.equal(node.Condition, e.condition)
      const payment = await fetch(url, { headers: { 'PAYMENT-SIGNATURE': buildPaymentSignatureHeaderForSignedBlob({
        req, signedTxBlob: create.blob, invoiceId: e.invoiceId }) } })
      assert.equal(payment.status, intent === 'withhold' ? 202 : 200)
      return { url, offer, create, sequence, node, response: await payment.json() }
    }
    const withheld = await buy('withhold') // Start its expiry clock while proving delivery.
    const delivered = await buy('deliver')
    const finish = validated((await client.request({ command: 'tx', transaction: delivered.response.finishHash })).result)
    const ft = txJSON(finish)
    assert.equal(ft.TransactionType, 'EscrowFinish'); assert.equal(ft.Owner, buyer.classicAddress)
    assert.equal(ft.OfferSequence, delivered.sequence)
    record('deliver finish', { hash: delivered.response.finishHash, result: finish })
    const plaintext = open(delivered.offer.extensions.keyReveal, ft, delivered.node.Condition)
    log(`Verified grant: sha256(K) matches on-ledger Condition; AES-GCM and plaintext hash OK`)
    log(plaintext) // First plaintext accessible to the buyer, after validated reveal and checks.
    const replay = await fetch(delivered.url, { headers: { 'PAYMENT-SIGNATURE': buildPaymentSignatureHeaderForSignedBlob({
      req: delivered.offer.accepts[0], signedTxBlob: delivered.create.blob,
      invoiceId: delivered.offer.accepts[0].extra.invoiceId }) } })
    assert.equal(replay.status, 200); assert.deepEqual(await replay.json(), delivered.response)
    const deadline = Date.now() + 90000
    while (await ledgerTime(client) <= withheld.node.CancelAfter) {
      assert.ok(Date.now() < deadline, 'ledger expiry wait timed out; original escrow remains pending')
      await wait(1000)
    }
    const before = BigInt((await client.request({ command: 'account_info', account: buyer.classicAddress,
      ledger_index: 'validated' })).result.account_data.Balance)
    const cancel = await submit(client, buyer, { TransactionType: 'EscrowCancel', Account: buyer.classicAddress,
      Owner: buyer.classicAddress, OfferSequence: withheld.sequence })
    record('withhold cancel', cancel)
    const after = BigInt((await client.request({ command: 'account_info', account: buyer.classicAddress,
      ledger_index: 'validated' })).result.account_data.Balance)
    assert.equal(after - before + BigInt(txJSON(cancel.result).Fee), 1000n)
    log('CancelAfter: 1000 drops principal returned; transaction fees are not refunded. RESULT PASS')
    return { receipts, plaintext }
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
    await client.disconnect()
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(() => { console.error('Example failed; inspect original Testnet escrows before retrying. No automatic re-pay.'); process.exitCode = 1 })
}
