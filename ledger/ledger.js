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
    if (row.condition && t.Condition !== row.condition) return 'Historical; condition mismatch'
    if (t.TransactionType !== type || (row.operation === 'create' ? t.Account !== row.owner || t.Sequence !== row.createSequence || t.Amount !== row.amountDrops : t.Owner !== row.owner || t.OfferSequence !== row.createSequence)) return 'Historical; escrow mismatch'
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
// One response, one allowlisted tx command; no account, wallet, signing or submission API.
export function lookup(hash, endpoint, Socket = WebSocket, timeout = 5000) {
  if (!/^[A-F0-9]{64}$/.test(hash) || !endpoints.includes(endpoint)) throw Error('Not allowlisted')
  return new Promise((resolve, reject) => {
    let socket
    const finish = (error, body) => { clearTimeout(timer); if (socket) { socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null; socket.close() } error ? reject(error) : resolve(body) }
    const timer = setTimeout(() => finish(Error('timeout')), timeout)
    try {
      socket = new Socket(endpoint)
      socket.onopen = () => socket.send(JSON.stringify({id: hash, command: 'tx', transaction: hash, binary: false, api_version: 2}))
      socket.onmessage = e => {
        try {
          if (typeof e.data !== 'string' || new TextEncoder().encode(e.data).byteLength > 262144) throw Error('oversized or malformed response')
          const body = JSON.parse(e.data)
          // rippled sends small unsolicited serverStatus notifications.
          if (body.type === 'serverStatus') return
          if (body.id !== hash) throw Error('response identity mismatch')
          finish(null, body)
        } catch (error) { finish(error) }
      }
      socket.onerror = () => finish(Error('connection unavailable (browser transport/CORS policy)'))
      socket.onclose = () => finish(Error('connection closed'))
    } catch (error) { finish(error) }
  })
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
  await Promise.all(Array.from({length: 2}, async () => {
    while (next < rows.length) {
      const row = rows[next++]
      let status = 'Historical; unavailable'
      for (const endpoint of endpoints) {
        try {
          const body = await lookup(row.hash, endpoint, Socket)
          status = classify(row, body)
          if (status.startsWith('validated') && row.keyReveal) {
            const proof = await fairExchange(row, body, await lookup(row.keyReveal.create.hash, endpoint, Socket))
            status = proof.startsWith('Key published') ? `${status} · ${proof}` : proof
          }
        }
        catch (error) { status = `Historical; ${error.message}` }
        if (status.startsWith('validated')) { status += ` · ${endpoint}`; break }
      }
      update(row.hash, status)
    }
  }))
}
if (typeof document !== 'undefined' && document.querySelector('#rows')) {
  const data = await (await fetch('transactions.json')).json()
  const cells = new Map()
  document.querySelector('#rows').replaceChildren()
  for (const row of data.rows) {
    const tr = document.createElement('tr')
    const amount = row.deliveredAmount ?? row.amountDrops ?? 'principal amount not recorded in this evidence'
    for (const text of [`${row.label ?? `${row.group}: ${row.operation ?? row.kind}`} · ${row.date}`, `${typeof amount === 'object' ? amount.value + ' RLUSD · issuer ' + amount.issuer : amount + (row.deliveredAmount || row.amountDrops ? ' drops' : '')} · fee ${row.feeDrops} drops`]) { const td = document.createElement('td'); td.textContent = text; tr.append(td) }
    const source = document.createElement('td'); const a = document.createElement('a'); a.href = 'https://github.com/Collaboration95/theFastandtheFungible/blob/' + (row.sourceCommit ?? 'f3902008b4be14d60f154fa6db3ba5c1dbe65943') + '/' + row.source; a.textContent = `Ledger ${row.ledgerIndex} · committed source`; source.append(a); tr.append(source)
    const td = document.createElement('td'); const link = document.createElement('a'); link.href = `https://testnet.xrpl.org/transactions/${row.hash}`; link.textContent = row.hash; const state = document.createElement('span'); state.className='state'; state.textContent='Historical; not freshly verified'; td.append(link,state); cells.set(row.hash,state); tr.append(td); document.querySelector('#rows').append(tr)
  }
  document.querySelector('caption').textContent = `${data.rows.length} curated transactions · snapshot ${data.snapshotDate}`
  const run = async () => {
    const button = document.querySelector('#refresh'); button.disabled = true
    let verified = 0
    await refresh(data.rows, WebSocket, (hash, status) => {
      const cell = cells.get(hash); cell.textContent = status
      cell.classList.toggle('verified', status.startsWith('validated'))
      if (status.startsWith('validated')) verified++
    })
    document.querySelector('#status').textContent = `Read-only check finished: ${verified}/${data.rows.length} validated. Historical evidence remains available.`
    button.disabled = false
  }
  document.querySelector('#refresh').onclick = run
  await run()
}
