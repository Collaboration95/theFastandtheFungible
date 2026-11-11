// One plain name per operation, shared by this page, scripts/ledger-artifact.mjs and /progress/.
export function operationLabel(row) {
  const op = `${row.type ?? ''} ${row.operation ?? ''} ${row.kind ?? ''} ${row.label ?? ''}`.toLowerCase()
  if (row.group === 'anchor') return row.head || /answer/.test(op) ? 'Answer anchor' : 'Account setup'
  if (/credential/.test(op)) return 'Writer credential'
  if (/refund/.test(op)) return 'Refund'
  if (/cancel/.test(op)) return 'Escrow returned'
  if (/finish/.test(op)) return 'Key published'
  if (/create/.test(op)) return 'Escrow locked'
  if (/purchase/.test(op)) return 'Payment'
  return 'Other'
}
export const rowContext = row => `${row.label ?? `${row.group}: ${row.operation ?? row.kind}`} · ${row.date}`
export const rowAmount = row => {
  const a = row.deliveredAmount ?? row.amountDrops
  return typeof a === 'object' ? `${a.value} ${currencyLabel(a.currency)} · issuer ${a.issuer}` : a ? `${(Number(a) / 1_000_000).toLocaleString('en-SG', { maximumFractionDigits: 6 })} XRP` : row.group === 'anchor' ? `Memo = audit head ${row.head.slice(0, 12)}…; answer anchor` : 'Principal amount not recorded in this evidence'
}
export const shortHash = hash => `${hash.slice(0, 8)}…${hash.slice(-8)}`.toUpperCase()
export const credentialTypeHex = text => Array.from(new TextEncoder().encode(text), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
export function classify(row, body) {
  const r = body?.result
  if (!r || r.error) return 'Historical; missing or reset history'
  if (r.validated !== true) return 'Historical; pending or unvalidated'
  const t = r.tx_json ?? r
  if (r.meta?.TransactionResult !== 'tesSUCCESS') return 'Historical; failed or malformed response'
  if ((t.hash ?? r.hash) !== row.hash || r.ledger_index !== row.ledgerIndex || (t.NetworkID !== undefined && t.NetworkID !== 1)) return 'Historical; identity or network mismatch'
  if (String(t.Fee) !== row.feeDrops) return 'Historical; fee mismatch'
  if (row.invoiceId && t.InvoiceID !== row.invoiceId) return 'Historical; binding mismatch'
  if (row.from && (t.Account !== row.from || t.Destination !== row.to || t.InvoiceID !== row.invoiceId)) return 'Historical; binding mismatch'
  if (row.group === 'Testnet, credential') {
    if (t.TransactionType !== row.operation || t.CredentialType !== credentialTypeHex(row.credentialTypeText) || (row.operation === 'CredentialCreate' ? t.Account !== row.issuer || t.Subject !== row.subject : t.Account !== row.subject || t.Issuer !== row.issuer)) return 'Historical; credential mismatch'
  } else if (row.group === 'escrow') {
    const type = { create: 'EscrowCreate', finish: 'EscrowFinish', cancel: 'EscrowCancel' }[row.operation]
    if (row.fulfillment && t.Fulfillment !== row.fulfillment) return 'Historical; key reveal mismatch'
    if (row.condition && t.Condition !== row.condition) return 'Historical; condition mismatch'
    if (t.TransactionType !== type || (row.operation === 'create' ? t.Account !== row.owner || t.Sequence !== row.createSequence || !sameAmount(t.Amount, row.amountDrops) || (row.destination && t.Destination !== row.destination) : t.Owner !== row.owner || t.OfferSequence !== row.createSequence)) return 'Historical; escrow mismatch'
  } else if (row.group === 'anchor') {
    const memo = t.Memos?.length === 1 ? t.Memos[0]?.Memo : undefined
    if (t.TransactionType !== 'AccountSet' || t.Account !== row.account || memo?.MemoType?.toUpperCase() !== credentialTypeHex('researchagent/anchor-v1') || !new RegExp('^' + credentialTypeHex(row.head + ':') + '[A-F0-9]{128}$').test(memo?.MemoData?.toUpperCase() ?? '')) return 'Historical; anchor memo mismatch'
  } else {
    if (t.TransactionType !== 'Payment' || (Number(t.Flags ?? 0) & 0x20000) || t.SendMax || t.Paths) return 'Historical; payment mismatch'
    const a = r.meta.delivered_amount
    const requested = t.DeliverMax ?? t.Amount
    if (!sameAmount(requested, row.deliveredAmount)) return 'Historical; requested amount mismatch'
    if (JSON.stringify(a) !== JSON.stringify(row.deliveredAmount)) {
      if (typeof a !== 'object' || typeof row.deliveredAmount !== 'object' || ['currency','issuer','value'].some(k => a?.[k] !== row.deliveredAmount[k])) return 'Historical; amount or issuer mismatch'
    }
  }
  return `validated · tesSUCCESS · ledger ${r.ledger_index}`
}
const sameAmount = (a, b) => typeof b === 'object' ? a && ['currency', 'issuer', 'value'].every(k => a[k] === b[k]) : a === b
export const endpoints = ['wss://s.altnet.rippletest.net:51233', 'wss://clio.altnet.rippletest.net:51233', 'wss://testnet.xrpl-labs.com']
// A refresh owns one connection per allowlisted endpoint. Only read-only tx RPCs.
export function connection(endpoint, Socket = WebSocket, timeout = 5000) {
  if (!endpoints.includes(endpoint)) throw Error('Not allowlisted')
  const pending = new Map()
  let socket, opened = false, closed = false, sequence = 0
  const close = (error = Error('connection closed')) => {
    if (closed) return
    closed = true
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error) }
    pending.clear()
    if (socket) { socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null; socket.close() }
  }
  const send = (id, request) => socket.send(JSON.stringify({id, command: 'tx', transaction: request.hash, binary: false, api_version: 2}))
  const query = hash => {
    if (!/^[A-F0-9]{64}$/.test(hash)) throw Error('Not allowlisted')
    return new Promise((resolve, reject) => {
      if (closed) { reject(Error('connection closed')); return }
      const id = ++sequence
      const request = { hash, resolve, reject, timer: setTimeout(() => close(Error('timeout')), timeout) }
      pending.set(id, request)
      try {
        if (!socket) {
          socket = new Socket(endpoint)
          socket.onopen = () => { opened = true; for (const [id, request] of pending) send(id, request) }
          socket.onmessage = e => {
            try {
              if (typeof e.data !== 'string' || new TextEncoder().encode(e.data).byteLength > 262144) throw Error('oversized or malformed response')
              const body = JSON.parse(e.data)
              if (body.type === 'serverStatus') return
              const request = pending.get(body.id)
              if (!request) throw Error('response identity mismatch')
              pending.delete(body.id); clearTimeout(request.timer); request.resolve(body)
            } catch (error) { close(error) }
          }
          socket.onerror = () => close(Error('connection unavailable (browser transport/CORS policy)'))
          socket.onclose = () => close()
        } else if (opened) send(id, request)
      } catch (error) { close(error) }
    })
  }
  return { query, close }
}
export function lookup(hash, endpoint, Socket = WebSocket, timeout = 5000) {
  if (!/^[A-F0-9]{64}$/.test(hash) || !endpoints.includes(endpoint)) throw Error('Not allowlisted')
  const client = connection(endpoint, Socket, timeout)
  return client.query(hash).finally(() => client.close())
}
export function currencyLabel(currency) {
  if (/^[A-Fa-f0-9]{40}$/.test(currency)) {
    const bytes = currency.match(/../g).map(byte => parseInt(byte, 16))
    currency = bytes.filter(byte => byte !== 0).every(byte => byte >= 32 && byte <= 126)
      ? String.fromCharCode(...bytes).replace(/\0+$/, '') : 'Nonstandard issued currency'
  }
  return currency === 'SGT' ? 'TEST-SGD IOU (SGT; stand-in for RLUSD)' : currency
}
// Public post-grant envelope only. No engine, wallet or transaction submission code.
const hexBytes = value => {
  if (typeof value !== 'string' || !/^(?:[A-Fa-f0-9]{2})+$/.test(value)) throw Error('malformed hex')
  return Uint8Array.from(value.match(/../g), byte => parseInt(byte, 16))
}
const sha256 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
export async function fairExchange(row, finishBody, createBody) {
  try {
    const proof = row.keyReveal
    if (!proof || !classify(row, finishBody).startsWith('validated') || !classify(proof.create, createBody).startsWith('validated')) throw Error('ledger binding unavailable')
    const finish = finishBody.result.tx_json ?? finishBody.result
    const create = createBody.result.tx_json ?? createBody.result
    if (!/^A0228020[A-F0-9]{64}$/.test(finish.Fulfillment)) throw Error('malformed Fulfillment')
    const memo = create.Memos?.find(m => m.Memo?.MemoType === '72657365617263686167656E742F657363726F772D7631'.toUpperCase())
    const terms = JSON.parse(new TextDecoder().decode(hexBytes(memo?.Memo.MemoData)))
    if (terms.manifestRoot !== proof.terms.manifestRoot || ['ciphertextHash','plaintextHash','iv','tag'].some(k => terms.keyReveal?.[k] !== proof.commitment[k])) throw Error('ledger manifest commitment mismatch')
    const key = hexBytes(finish.Fulfillment.slice(8))
    const condition = `A0258020${(await sha256(key)).toUpperCase()}810120`
    if (condition !== create.Condition || condition !== finish.Condition || condition !== proof.condition) throw Error('sha256(K) / Condition mismatch')
    if (await sha256(hexBytes(proof.ciphertext)) !== proof.commitment.ciphertextHash) throw Error('ciphertext commitment mismatch')
    const bytes = hexBytes(proof.ciphertext), tag = hexBytes(proof.commitment.tag)
    const sealed = new Uint8Array(bytes.length + tag.length); sealed.set(bytes); sealed.set(tag, bytes.length)
    const aes = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt'])
    const plaintext = await crypto.subtle.decrypt({name:'AES-GCM', iv:hexBytes(proof.commitment.iv)}, aes, sealed)
    if (await sha256(plaintext) !== proof.commitment.plaintextHash) throw Error('plaintext commitment mismatch')
    return `Key published in ledger ${row.ledgerIndex} ✓ · sha256(K) = Condition ✓ · ciphertext sha256 matches recorded manifest ✓ · AES-GCM decrypt ✓`
  } catch (error) { return `Fair-exchange proof failed: ${error.message}` }
}
export async function refresh(rows, Socket = WebSocket, update = () => {}) {
  let next = 0
  const clients = new Map()
  const query = (hash, endpoint) => {
    if (!clients.has(endpoint)) clients.set(endpoint, connection(endpoint, Socket))
    return clients.get(endpoint).query(hash)
  }
  try { await Promise.all(Array.from({length: 16}, async () => {
    while (next < rows.length) {
      const row = rows[next++]
      let status = 'Historical; unavailable'
      for (const endpoint of endpoints) {
        try {
          const body = await query(row.hash, endpoint)
          status = classify(row, body)
          if (status.startsWith('validated') && row.keyReveal) {
            const proof = await fairExchange(row, body, await query(row.keyReveal.create.hash, endpoint))
            status = proof.startsWith('Key published') ? `${status} · ${proof}` : proof
          }
        }
        catch (error) { status = `Historical; ${error.message}` }
        if (status.startsWith('validated')) { status += ` · ${endpoint}`; break }
      }
      update(row.hash, status)
    }
  })) } finally { for (const client of clients.values()) client.close() }
}
if (typeof document !== 'undefined' && document.querySelector('#rows')) {
  const data = await (await fetch('transactions.json')).json()
  const cells = new Map()
  document.querySelector('#rows').replaceChildren()
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node }
  for (const row of data.rows) {
    const tr = document.createElement('tr')
    const op = el('td'); op.append(el('span', 'op', operationLabel(row)), el('span', 'ctx', rowContext(row)))
    const money = el('td'), amount = el('span', 'amt', rowAmount(row))
    const drops = row.deliveredAmount ?? row.amountDrops
    if (typeof drops === 'string') amount.title = `${Number(drops).toLocaleString('en-SG')} drops`
    money.append(amount, el('span', 'fee', `fee ${row.feeDrops} drops`))
    const source = el('td'); const a = el('a', null, `Ledger ${row.ledgerIndex} · committed source`); a.href = 'https://github.com/Collaboration95/theFastandtheFungible/blob/' + (row.sourceCommit ?? 'f3902008b4be14d60f154fa6db3ba5c1dbe65943') + '/' + row.source; source.append(a)
    const td = el('td'); const link = el('a', 'hash', shortHash(row.hash)); link.href = `https://testnet.xrpl.org/transactions/${row.hash}`; link.title = row.hash; link.setAttribute('aria-label', `Transaction ${row.hash}`); const state = el('span', 'state', 'Checking live…'); td.append(link, state); cells.set(row.hash, state)
    tr.append(op, money, source, td); document.querySelector('#rows').append(tr)
  }
  document.querySelector('caption').textContent = `${data.rows.length} curated transactions · snapshot ${data.snapshotDate}`
  const run = async () => {
    const button = document.querySelector('#refresh'); button.disabled = true
    let verified = 0, checked = 0
    document.querySelector('#status').textContent = `Checking ${data.rows.length} hashes live… 0/${data.rows.length}`
    const meter = document.querySelector('#meter')
    if (meter) meter.style.width = '0%'
    await refresh(data.rows, WebSocket, (hash, status) => {
      document.querySelector('#status').textContent = `Checking ${data.rows.length} hashes live… ${++checked}/${data.rows.length}`
      if (meter) meter.style.width = `${(checked / data.rows.length) * 100}%`
      const cell = cells.get(hash); cell.textContent = status.replace('sha256(K) = Condition ✓', 'Key matches the escrow lock ✓')
      if (status.startsWith('validated') && status.includes('sha256(K) = Condition ✓')) {
        const detail = el('details'); detail.append(el('summary', null, 'Technical details'), el('code', null, 'sha256(K) = Condition ✓')); cell.append(detail)
      }
      cell.classList.toggle('verified', status.startsWith('validated'))
      if (status.startsWith('validated')) verified++
    })
    document.querySelector('#status').textContent = `Read-only check finished: ${verified}/${data.rows.length} validated. Historical evidence remains available.`
    button.disabled = false
  }
  document.querySelector('#refresh').onclick = run
  await run()
}

// Real, consenting writers only: rendered from the committed evidence list, never from the fictional corpus.
export function renderRealWriters(list, writers) {
  list.textContent = writers.length ? '' : 'No consenting writers listed yet.'
  for (const writer of writers) {
    const p = document.createElement('p'), a = document.createElement('a')
    a.href = `https://testnet.xrpl.org/accounts/${encodeURIComponent(writer.address)}`; a.textContent = writer.address
    p.append(`${writer.name} · `, a, ' · real person · Testnet · no real value'); list.append(p)
  }
}
if (typeof document !== 'undefined' && document.querySelector('#real-writers')) {
  const list = document.querySelector('#real-writers')
  try {
    const response = await fetch('../evidence/real-writers.json')
    if (!response.ok) throw Error('unavailable')
    renderRealWriters(list, (await response.json()).writers)
  } catch { list.textContent = 'Writer list unavailable.' }
}
