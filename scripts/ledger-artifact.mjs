import { operationLabel, rowContext, rowAmount, shortHash } from '../site/ledger/ledger.js'
import { dateSGT } from '../site/brand/presentation.js'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
const read = p => readFileSync(path.join(root, p), 'utf8')
const priority = row => row.keyReveal ? 0 : row.group === 'anchor' ? 1 : row.label?.includes('key reveal') ? 2 : 3
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
  // Curate only hashes present in the original lane evidence; bind fields to retained tx responses.
  const retained = JSON.parse(read('docs/evidence/round3-r2/ledger-responses.json'))
  const lanes = {
    'round3-e': JSON.parse(read('docs/evidence/round3-e/runs.json')).flatMap(r => r.hashes),
    'round3-a': JSON.parse(read('docs/evidence/round3-a/probe.json')).timings.flatMap(r => r.transactions.map(t => t.hash)),
    'round3-d': JSON.parse(read('docs/evidence/round3-d/probe.json')).transactions.map(t => t.hash),
    'round3-c': JSON.parse(read('docs/evidence/round3-c/onboarding.json')).transactions.map(t => t.hash),
  }
  for (const { hash, lane, mode, response: r } of retained) {
    if (!lanes[lane]?.includes(hash) || r.hash !== hash || !r.validated || r.meta?.TransactionResult !== 'tesSUCCESS') throw Error('Invalid round-three evidence')
    const t = r.tx_json
    const row = { hash, ledgerIndex: r.ledger_index, feeDrops: t.Fee, date: r.close_time_iso.slice(0, 10), source: 'docs/evidence/round3-r2/ledger-responses.json', sourceCommit: '2cf29b3cee5687e7db67fa4b2eee374c814889e1', label: `${lane}: ${mode ?? 'synthetic writer / fixture models'} · ${t.TransactionType}` }
    if (t.TransactionType.startsWith('Escrow')) {
      const create = t.TransactionType === 'EscrowCreate' ? t : retained.find(x => x.response.tx_json.TransactionType === 'EscrowCreate' && x.response.tx_json.Account === t.Owner && x.response.tx_json.Sequence === t.OfferSequence)?.response.tx_json
      if (!create) throw Error('Missing escrow create')
      Object.assign(row, { group: 'escrow', operation: {EscrowCreate:'create',EscrowFinish:'finish',EscrowCancel:'cancel'}[t.TransactionType], owner: create.Account, destination: create.Destination, createSequence: create.Sequence, amountDrops: create.Amount, condition: t.Condition, fulfillment: t.Fulfillment })
      if (lane === 'round3-e') row.label += ' · TEST-SGD IOU · stand-in for RLUSD · token escrow (XLS-85)'
    } else if (t.TransactionType === 'AccountSet') {
      const memo = t.Memos.find(m => Buffer.from(m.Memo.MemoType, 'hex').toString() === 'researchagent/anchor-v1').Memo
      Object.assign(row, { group:'anchor', operation:'anchor', account:t.Account, head:Buffer.from(memo.MemoData, 'hex').toString().split(':')[0] })
    } else if (t.TransactionType === 'CredentialCreate') Object.assign(row, { group:'Testnet, credential', operation:t.TransactionType, issuer:t.Account, subject:t.Subject, credentialTypeText:Buffer.from(t.CredentialType,'hex').toString() })
    else throw Error('Unsupported round-three transaction')
    rows.push(row)
  }
  const refreshSource = 'docs/evidence/r5-r/ledger-responses.json'
  const refreshed = JSON.parse(read(refreshSource))
  for (const { hash, source, response: r } of refreshed) {
    if (!read(source).includes(hash) || r.hash !== hash || !r.validated || r.meta?.TransactionResult !== 'tesSUCCESS') throw Error('Invalid round-five evidence')
    const t = r.tx_json
    const row = { hash, ledgerIndex: r.ledger_index, feeDrops: t.Fee, date: r.close_time_iso.slice(0, 10), source: refreshSource, sourceCommit: 'afb90bf7e027b82aa60d1c8afa047d3483c6608b', label: `${source.includes('j5-coverage') ? 'Team-authored writer · fixture models' : source.includes('m1-iou') ? 'TEST-SGD IOU · stand-in for RLUSD · fictional writer' : 'Local publish onboarding · generated test note'} · ${t.TransactionType}` }
    if (t.TransactionType.startsWith('Escrow')) {
      const create = t.TransactionType === 'EscrowCreate' ? t : refreshed.find(x => x.response.tx_json.TransactionType === 'EscrowCreate' && x.response.tx_json.Account === t.Owner && x.response.tx_json.Sequence === t.OfferSequence)?.response.tx_json
      if (!create) throw Error('Missing round-five create')
      Object.assign(row, { group: 'escrow', operation: { EscrowCreate: 'create', EscrowFinish: 'finish' }[t.TransactionType], owner: create.Account, destination: create.Destination, createSequence: create.Sequence, amountDrops: create.Amount, condition: t.Condition, fulfillment: t.Fulfillment })
    } else if (t.TransactionType === 'AccountSet') {
      const memo = t.Memos.find(m => Buffer.from(m.Memo.MemoType, 'hex').toString() === 'researchagent/anchor-v1').Memo
      Object.assign(row, { group: 'anchor', operation: 'anchor', account: t.Account, head: Buffer.from(memo.MemoData, 'hex').toString().split(':')[0] })
    } else if (t.TransactionType === 'CredentialCreate') Object.assign(row, { group: 'Testnet, credential', operation: t.TransactionType, issuer: t.Account, subject: t.Subject, credentialTypeText: Buffer.from(t.CredentialType, 'hex').toString() })
    else throw Error('Unsupported round-five transaction')
    rows.push(row)
  }
  rows.sort((a, b) => priority(a) - priority(b))
  if (rows.length !== new Set(rows.map(r => r.hash)).size) throw Error('Duplicate ledger hash')
  return JSON.stringify({ network: 'xrpl:1', snapshotDate: '2026-11-07', label: 'TESTNET · no real value · historical evidence', rows }, null, 2) + '\n'
}
function htmlArtifact(out) {
  const escape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
  const dropsTitle = r => typeof (r.deliveredAmount ?? r.amountDrops) === 'string' ? `${Number(r.deliveredAmount ?? r.amountDrops).toLocaleString('en-SG')} drops` : ''
  const rows = JSON.parse(out).rows.map(r => `<tr><td><span class="op">${operationLabel(r)}</span><span class="ctx">${escape(rowContext(r))}</span></td><td><span class="amt" title="${escape(dropsTitle(r))}">${escape(rowAmount(r))}</span><span class="fee">fee ${r.feeDrops} drops</span></td><td><a href="https://github.com/Collaboration95/theFastandtheFungible/blob/${r.sourceCommit ?? 'f3902008b4be14d60f154fa6db3ba5c1dbe65943'}/${r.source}">Ledger ${r.ledgerIndex} · committed source</a></td><td><a class="hash" href="https://testnet.xrpl.org/transactions/${r.hash}" title="${r.hash}" aria-label="Transaction ${r.hash}">${shortHash(r.hash)}</a><span class="state">Historical; not freshly verified</span></td></tr>`).join('')
  return read('site/ledger/index.html').replace(/Checking \d+ hashes live… 0\/\d+/, `Checking ${JSON.parse(out).rows.length} hashes live… 0/${JSON.parse(out).rows.length}`).replace(/<caption>.*?<\/caption>/, `<caption>${JSON.parse(out).rows.length} curated transactions · snapshot ${dateSGT(JSON.parse(out).snapshotDate + 'T00:00:00Z')}</caption>`).replace(/<tbody id="rows">[\s\S]*?<\/tbody>/, `<tbody id="rows">${rows}</tbody>`)
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = artifact()
  const html = htmlArtifact(out)
  if (process.argv.includes('--check')) { if (read('site/ledger/transactions.json') !== out || read('site/ledger/index.html') !== html) throw Error('Stale ledger artifact') }
  else { writeFileSync(path.join(root, 'site/ledger/transactions.json'), out); writeFileSync(path.join(root, 'site/ledger/index.html'), html) }
}
