import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
const read = p => readFileSync(path.join(root, p), 'utf8')
export function artifact() {
  const rows = JSON.parse(read('docs/evidence/round2-e/curation.json'))
  if (rows.length !== 9 || new Set(rows.map(r => r.hash)).size !== 9) throw Error('Expected nine unique hashes')
  for (const r of rows) {
    if (!/^[A-F0-9]{64}$/.test(r.hash) || !read(r.source).includes(r.hash)) throw Error('Missing source hash')
    if (r.invoiceId && !read(r.source).includes(r.invoiceId)) throw Error('Missing invoice binding')
    if (r.source.endsWith('.json')) {
      const source = JSON.parse(read(r.source))
      const ts = source.transactions ?? Object.values(source.runs).flatMap(x => x.transactions)
      if (!ts.some(t => t.hash === r.hash && Object.entries(t).every(([k,v]) => JSON.stringify(r[k]) === JSON.stringify(v)))) throw Error('Source fields differ')
    } else if (!read(r.source).includes(`\`${r.hash}\` | ${r.ledgerIndex} | ${r.deliveredAmount} / ${r.deliveredAmount}`)) throw Error('Interop fields differ')
  }
  return JSON.stringify({ network: 'xrpl:1', snapshotDate: '2026-11-03', label: 'TESTNET · no real value · historical evidence', rows }, null, 2) + '\n'
}
function htmlArtifact(out) {
  const escape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
  const rows = JSON.parse(out).rows.map(r => {
    const a = r.deliveredAmount ?? r.amountDrops
    const amount = typeof a === 'object' ? `${a.value} RLUSD · issuer ${a.issuer}` : a ? `${a} drops` : 'Principal amount not recorded in this evidence'
    return `<tr><td>${escape(r.group)}: ${escape(r.operation ?? r.kind)} · ${r.date}</td><td>${escape(amount)} · fee ${r.feeDrops} drops</td><td><a href="https://github.com/Collaboration95/theFastandtheFungible/blob/ec97bfdfe38e61b1b1b3fed6a1b4d3546052927c/${r.source}">Ledger ${r.ledgerIndex} · committed source</a></td><td><a href="https://testnet.xrpl.org/transactions/${r.hash}">${r.hash}</a><span class="state">Historical; not freshly verified</span></td></tr>`
  }).join('')
  return read('site/ledger/index.html').replace(/<tbody id="rows">[\s\S]*?<\/tbody>/, `<tbody id="rows">${rows}</tbody>`)
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = artifact()
  const html = htmlArtifact(out)
  if (process.argv.includes('--check')) { if (read('site/ledger/transactions.json') !== out || read('site/ledger/index.html') !== html) throw Error('Stale ledger artifact') }
  else { writeFileSync(path.join(root, 'site/ledger/transactions.json'), out); writeFileSync(path.join(root, 'site/ledger/index.html'), html) }
}
