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
    if (t.TransactionType !== type || (row.operation === 'create' ? t.Account !== row.owner || t.Sequence !== row.createSequence || t.Amount !== row.amountDrops : t.Owner !== row.owner || t.OfferSequence !== row.createSequence)) return 'Historical; escrow mismatch'
  } else {
    if (t.TransactionType !== 'Payment' || (Number(t.Flags ?? 0) & 0x20000) || t.SendMax || t.Paths) return 'Historical; payment mismatch'
    const a = r.meta.delivered_amount
    if (JSON.stringify(a) !== JSON.stringify(row.deliveredAmount)) {
      if (typeof a !== 'object' || typeof row.deliveredAmount !== 'object' || ['currency','issuer','value'].some(k => a?.[k] !== row.deliveredAmount[k])) return 'Historical; amount or issuer mismatch'
    }
  }
  return 'Freshly verified on Testnet'
}
export async function refresh(rows, fetcher = fetch, update = () => {}) {
  let next = 0
  await Promise.all(Array.from({length: 2}, async () => {
    while (next < rows.length) {
      const row = rows[next++]
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      try {
        const response = await fetcher('https://testnet.xrpl-labs.com/', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({method:'tx',params:[{transaction:row.hash, binary:false, api_version:2}]}), signal:controller.signal})
        if (!response.ok) throw Error('HTTP unavailable')
        const reader = response.body.getReader(); let size = 0; let text = ''; const decoder = new TextDecoder()
        try { for (;;) { const {value,done} = await reader.read(); if (done) break; size += value.byteLength; if(size > 262144) throw Error('Response limit'); text += decoder.decode(value,{stream:true}) } } finally { await reader.cancel() }
        update(row.hash, classify(row, JSON.parse(text)))
      } catch { update(row.hash, 'Historical; not freshly verified (unavailable, timeout or CORS)') }
      finally { clearTimeout(timer) }
    }
  }))
}
if (typeof document !== 'undefined') {
  const data = await (await fetch('transactions.json')).json()
  const cells = new Map()
  document.querySelector('#rows').replaceChildren()
  for (const row of data.rows) {
    const tr = document.createElement('tr')
    const amount = row.deliveredAmount ?? row.amountDrops ?? 'principal amount not recorded in this evidence'
    for (const text of [`${row.group}: ${row.operation ?? row.kind} · ${row.date}`, `${typeof amount === 'object' ? amount.value + ' RLUSD · issuer ' + amount.issuer : amount + (row.deliveredAmount || row.amountDrops ? ' drops' : '')} · fee ${row.feeDrops} drops`]) { const td = document.createElement('td'); td.textContent = text; tr.append(td) }
    const source = document.createElement('td'); const a = document.createElement('a'); a.href = 'https://github.com/Collaboration95/theFastandtheFungible/blob/ec97bfdfe38e61b1b1b3fed6a1b4d3546052927c/' + row.source; a.textContent = `Ledger ${row.ledgerIndex} · committed source`; source.append(a); tr.append(source)
    const td = document.createElement('td'); const link = document.createElement('a'); link.href = `https://testnet.xrpl.org/transactions/${row.hash}`; link.textContent = row.hash; const state = document.createElement('span'); state.className='state'; state.textContent='Historical; not freshly verified'; td.append(link,state); cells.set(row.hash,state); tr.append(td); document.querySelector('#rows').append(tr)
  }
  document.querySelector('#refresh').onclick = async e => { e.target.disabled=true; await refresh(data.rows,fetch,(hash,status) => { cells.get(hash).textContent=status }); document.querySelector('#status').textContent='Read-only check finished. Historical evidence remains available.'; e.target.disabled=false }
}
