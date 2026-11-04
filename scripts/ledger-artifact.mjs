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
  const credentials = JSON.parse(read('docs/evidence/round2-n/transactions.json')).transactions
  for (const row of credentials) if (!/^[A-F0-9]{64}$/.test(row.hash) || !Number.isInteger(row.ledgerIndex) || typeof row.credentialTypeText !== 'string' || !/^(?:[A-F0-9]{2}){1,64}$/.test(Buffer.from(row.credentialTypeText, 'utf8').toString('hex').toUpperCase())) throw Error('Invalid credential evidence')
  const p2 = JSON.parse(read('docs/evidence/round2-p2/transactions.json')).transactions
  for (const row of p2) if (!/^[A-F0-9]{64}$/.test(row.hash) || !Number.isInteger(row.ledgerIndex) || row.source !== 'docs/evidence/round2-p2/transactions.json') throw Error('Invalid P2 evidence')
  rows.push(...credentials, ...p2.map(row => ({ ...row, sourceCommit: 'bb55d448dde4d365a2bda4777c661657b46b5757' })))
  const evidencePath = 'docs/evidence/round2-r/transactions.json'
  const reveal = JSON.parse(read(evidencePath)).transactions
  const sourceRef = '30a9898282286252d25bc1cfe15c3f88004cd8ae'
  if (!/^[a-f0-9]{40}$/.test(sourceRef)) throw Error('Commit key-reveal evidence before generating ledger rows')
  for (const r of reveal) {
    if (!/^[A-F0-9]{64}$/.test(r.hash) || r.result !== 'tesSUCCESS' || !Number.isInteger(r.ledgerIndex)) throw Error('Invalid key-reveal ledger evidence')
    const create = reveal.find(c => c.path === r.path && c.type === 'EscrowCreate')
    rows.push({ ...r, label: { EscrowCreate:'key reveal: EscrowCreate', EscrowFinish:'EscrowFinish (key published)', EscrowCancel:'EscrowCancel (writer no-show)' }[r.type], group: 'escrow', operation: { EscrowCreate: 'create', EscrowFinish: 'finish', EscrowCancel: 'cancel' }[r.type], date: '2026-11-04', owner: create.account, createSequence: r.offerSequence ?? create.sequence, amountDrops: create.amount, source: evidencePath, sourceCommit: sourceRef })
  }
  const oldProof = JSON.parse(read('docs/evidence/round2-r/happy-receipt.json')).proofs[0].keyReveal
  const oldFinish = rows.find(r => r.hash === oldProof.finishHash)
  oldFinish.keyReveal = { create: rows.find(r => r.hash === oldProof.createHash), terms: oldProof.quote.terms, condition: oldProof.quote.terms.condition, commitment: oldProof.quote.terms.keyReveal, ciphertext: oldProof.quote.ciphertext }
  const v1Path = 'docs/evidence/round2-v1/transactions.json'
  const v1 = JSON.parse(read(v1Path)).transactions
  const proof = JSON.parse(read('docs/evidence/round2-v1/proof.json'))
  for (const row of v1) {
    if (!/^[A-F0-9]{64}$/.test(row.hash) || !Number.isInteger(row.ledgerIndex) || row.source !== v1Path) throw Error('Invalid V1 evidence')
    rows.push({ ...row, sourceCommit: JSON.parse(read('docs/evidence/round2-v1/source.json')).commit })
  }
  const finish = rows.find(r => r.hash === proof.finishHash)
  finish.keyReveal = { create: rows.find(r => r.hash === proof.createHash), terms: proof.quote.terms, condition: proof.quote.terms.condition, commitment: proof.quote.terms.keyReveal, ciphertext: proof.quote.ciphertext }
  const anchors = JSON.parse(read('docs/evidence/round2-t/transactions.json')).transactions
  for (const row of anchors) {
    if (!/^[A-F0-9]{64}$/.test(row.hash) || row.result !== 'tesSUCCESS' || !Number.isInteger(row.ledgerIndex)) throw Error('Invalid answer anchor evidence')
    rows.push({ ...row, sourceCommit: 'fba9010bb52ab245370ba7c8362226ff107ada90' })
  }
  return JSON.stringify({ network: 'xrpl:1', snapshotDate: '2026-11-04', label: 'TESTNET · no real value · historical evidence', rows }, null, 2) + '\n'
}
function htmlArtifact(out) {
  const escape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
  const rows = JSON.parse(out).rows.map(r => {
    const a = r.deliveredAmount ?? r.amountDrops
    const amount = typeof a === 'object' ? `${a.value} RLUSD · issuer ${a.issuer}` : a ? `${a} drops` : r.group === 'anchor' ? `Memo = audit head ${r.head.slice(0, 12)}…; answer anchor` : 'Principal amount not recorded in this evidence'
    return `<tr><td>${escape(r.label ?? `${r.group}: ${r.operation ?? r.kind}`)} · ${r.date}</td><td>${escape(amount)} · fee ${r.feeDrops} drops</td><td><a href="https://github.com/Collaboration95/theFastandtheFungible/blob/${r.sourceCommit ?? 'f3902008b4be14d60f154fa6db3ba5c1dbe65943'}/${r.source}">Ledger ${r.ledgerIndex} · committed source</a></td><td><a href="https://testnet.xrpl.org/transactions/${r.hash}">${r.hash}</a><span class="state">Historical; not freshly verified</span></td></tr>`
  }).join('')
  return read('site/ledger/index.html').replace(/<caption>.*?<\/caption>/, `<caption>${JSON.parse(out).rows.length} curated transactions · snapshot ${JSON.parse(out).snapshotDate}</caption>`).replace(/<tbody id="rows">[\s\S]*?<\/tbody>/, `<tbody id="rows">${rows}</tbody>`)
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = artifact()
  const html = htmlArtifact(out)
  if (process.argv.includes('--check')) { if (read('site/ledger/transactions.json') !== out || read('site/ledger/index.html') !== html) throw Error('Stale ledger artifact') }
  else { writeFileSync(path.join(root, 'site/ledger/transactions.json'), out); writeFileSync(path.join(root, 'site/ledger/index.html'), html) }
}
