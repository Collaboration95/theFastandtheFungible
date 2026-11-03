import { sourceKey, sourceBinding } from '../shared/source-identity.js'
import { ReceiptBundleSchema, type ReceiptBundle } from '../shared/contracts/receipts.js'
import { ReportSchema } from '../shared/contracts/report.js'
import { canonical, entryHash, GENESIS_HASH, verifyOnTestnet, verifyEscrowEvents, type AuditEntry } from '../server/audit.js'
import { leafHash, manifestRoot, sha256, verifyDelivery, verifyManifestSignature } from '../shared/manifest.js'
import { amountFor } from '../shared/contracts/asset.js'
import { XRPL_LABEL } from '../shared/contracts/index.js'
import { type Ledger, testnetLedger, testnetUrl } from '../shared/xrpl.js'
import { ledgerInvoiceId } from '../shared/x402.js'

export type VerificationCheck = { check: string; status: 'PASS' | 'FAIL' | 'SKIP'; detail: string }
export type VerificationResult = { ok: boolean; runId?: string; checks: VerificationCheck[] }
export type VerifyOptions = { testnet?: boolean; expectHead?: string; ledger?: Ledger }
const key = sourceKey
/** No backend, database, signer or provider required. Network is opt-in and read-only. */
export async function verifyAnswer(input: unknown, options: VerifyOptions = {}): Promise<VerificationResult> {
  const checks: VerificationCheck[] = []
  const add = (check: string, ok: boolean, detail: string) => checks.push({ check, status: ok ? 'PASS' : 'FAIL', detail })
  let raw = input
  let exportedReport: unknown
  if (input && typeof input === 'object' && 'verification' in input) { const exported = input as { verification: unknown; report?: unknown }; raw = exported.verification; exportedReport = exported.report }
  const parsed = ReceiptBundleSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, checks: [{ check: 'bundle', status: 'FAIL', detail: `Invalid or legacy bundle at ${parsed.error.issues[0]?.path.join('.')}. Export receipts.json with this version.` }] }
  const b = parsed.data
  if (b.schemaVersion === 1) {
    if ([...b.sources, ...b.candidates, ...b.intents, ...b.grants, ...b.receipts, ...b.intents.flatMap(i => i.quote ?? []), ...b.proofs, ...b.answers.flatMap(a => a.claims.flatMap(c => c.citations))].some(s => s.source)) return { ok: false, checks: [{ check: 'version', status: 'FAIL', detail: 'v1 cannot carry routing identities' }] }
    checks.push({ check: 'historical origin', status: 'SKIP', detail: 'v1 origin unresolved; original singleton semantics' })
  } else {
    add('source binding', [...b.sources, ...b.candidates, ...b.intents, ...b.grants, ...b.receipts, ...b.intents.flatMap(i => i.quote ?? []), ...b.proofs, ...b.answers.flatMap(a => a.claims.flatMap(c => c.citations))].every(s => !!s.source && sourceBinding(s)), 'v2 references require complete matching identity')
    for (const i of b.intents) {
      const reserved = entriesForOrigin(b, i.intentId, key(i)) && !!i.quote && key(i.quote) === key(i)
      const refused = i.status === 'SKIPPED' && !i.txHash && !i.receiptId && !i.escrow && (!i.quote || key(i.quote) === key(i)) &&
        ![...b.payments, ...b.receipts, ...b.grants].some(r => r.intentId === i.intentId) &&
        !b.audit.entries.some(e => !('commitment' in e) && e.intentId === i.intentId && ['sign','escrow-sign','settle','ESCROW_CREATE'].includes(e.kind)) && entriesForOrigin(b, i.intentId, key(i), 'refusal')
      add(`origin reservation ${i.intentId}`, reserved || refused, 'Saved endpoint context matches pre-sign reservation or unsigned, uncharged refusal')
    }
  }
  const unique = (items: string[]) => new Set(items).size === items.length
  add('identities', unique(b.sources.map(key)) && unique(b.proofs.map(key)) && unique(b.intents.map(i => i.intentId)) && unique(b.payments.map(p => p.intentId)), 'Unambiguous source, proof and intent identities')
  const entries = b.audit.entries.filter((e): e is AuditEntry => !('commitment' in e))
  let prev = b.audit.anchor.hash, seq = b.audit.anchor.seq, chainOk = seq !== 0 || prev === GENESIS_HASH
  for (const e of b.audit.entries) {
    const ok = e.seq === seq + 1 && e.prevHash === prev && ('commitment' in e || e.hash === entryHash(e.seq, e.at, prev, e.runId, e.intentId, e.surface, e.principal, e.kind, canonical(e.data)))
    if (!ok) add(`audit seq ${e.seq}`, false, 'Chain link or entry hash differs')
    chainOk &&= ok; seq = e.seq; prev = e.hash
  }
  add('audit chain', chainOk && b.audit.entries.length > 0 && prev === b.audit.head && (!options.expectHead || prev === options.expectHead), `${b.audit.entries.length} links; head ${b.audit.head}`)
  checks.push({ check: 'audit anchor', status: options.expectHead ? (prev === options.expectHead ? 'PASS' : 'FAIL') : 'SKIP', detail: options.expectHead ? 'Compared to independently supplied head' : 'Self-contained chain only; use --expect-head to detect a rewritten/truncated export. Other runs are opaque hash commitments.' })
  const sourceOk = new Map<string, boolean>()
  for (const s of b.sources) {
    const proofs = b.proofs.filter(p => key(p) === key(s)), p = proofs[0]
    const candidates = b.candidates.filter(c => key(c) === key(s)), candidate = candidates[0]
    const bound = proofs.length === 1 && candidates.length === 1 && p.manifest.articleId === s.resourceId && p.manifest.version === s.version && p.manifest.publisherSlug === s.profileId && (!s.source || s.source.sellerKey === p.manifest.pubKey) && candidate.profileId === s.profileId && (candidate.tier === 'PAID' ? p.manifest.priceMinor > 0 : p.manifest.priceMinor === 0) && (!candidate.wallet || candidate.wallet === p.manifest.wallet)
    const signed = Boolean(bound && verifyManifestSignature(p.manifest))
    add(`manifest ${key(s)}`, signed, signed ? `Writer key derives to ${p.manifest.wallet}; identity unverified` : 'Missing, ambiguous or invalid writer signature/identity')
    const hashOk = Boolean(bound && verifyDelivery(s.body, s.spans, p.salts, p.manifest).ok && p.salts.length === s.spans.length && unique(s.spans.map(x => x.id)))
    add(`passages ${key(s)}`, hashOk, hashOk ? 'Delivered passages match signed leaves and root' : `Delivered passages differ from signed manifest or proof is missing: ${s.resourceId}@${s.version}`)
    sourceOk.set(key(s), signed)
    if (candidate?.tier === 'PAID') {
      const intent = b.intents.find(i => i.intentId === p?.intentId), grant = b.grants.find(g => g.intentId === p?.intentId), payment = b.payments.find(r => r.intentId === p?.intentId)
      add(`grant ${key(s)}`, Boolean(intent?.status === 'VERIFIED' && grant?.runId === b.runId && grant.contentDigest === p?.manifest.root && key(grant) === key(s) && intent.profileId === s.profileId && payment?.payee === p?.manifest.wallet && p.manifest.priceMinor === intent.amountMinor && entries.some(e => e.kind === 'proof' && e.intentId === intent.intentId && e.data.verified === true && (intent.escrow ? e.data.scheme === 'escrow-v1' : e.data.contentDigest === p.manifest.root))), 'Paid source requires verified grant, matching manifest and writer receipt')
    }
  }
  const claimSets = b.answers.map(a => ({ name: `answer v${a.version}`, claims: a.claims }))
  if (exportedReport !== undefined) {
    const report = ReportSchema.safeParse(exportedReport)
    add('report', report.success && report.data.access?.runId === b.runId && canonical(report.data.sources) === canonical(b.sources) && canonical(report.data.receipts) === canonical(b.receipts) && canonical(report.data.refunds ?? []) === canonical(b.intents.filter(i => i.refund).map(i => ({ intentId: i.intentId, resourceId: i.resourceId, version: i.version, ...i.refund! }))), 'Report sources, receipts and refunds match the bundled run')
    if (report.success) for (const [name, claims] of Object.entries({ findings: report.data.findings, first: report.data.firstFindings ?? [], final: report.data.finalFindings ?? [] })) claimSets.push({ name: `report ${name}`, claims })
  }
  for (const group of claimSets) for (const claim of group.claims) for (const ref of claim.citations) {
    const s = b.sources.find(s => key(s) === key(ref)), p = b.proofs.find(p => key(p) === key(ref)), index = s?.spans.findIndex(span => span.id === ref.spanId) ?? -1
    const exact = index >= 0 && !!s && !!p && s.body.includes(s.spans[index].text) && leafHash(p.salts[index], index, ref.spanId, s.spans[index].text) === p.manifest.leaves[index] && manifestRoot(p.manifest.leaves) === p.manifest.root
    add(`citation ${group.name}/${claim.id} ${ref.source ? key(ref) : `${ref.resourceId}@${ref.version}`}#${ref.spanId}`, exact && sourceOk.get(key(ref)) === true, !exact ? 'Exact citation passage missing or hash mismatch' : sourceOk.get(key(ref)) ? 'Exact delivered passage, signed hash' : 'Source signature invalid or missing')
  }
  for (const intent of b.intents.filter(i => i.receiptId || i.refund || i.status === 'VERIFIED')) {
    const rows = b.payments.filter(p => p.intentId === intent.intentId), row = rows[0], receipt = b.receipts.find(r => r.intentId === intent.intentId), terms = intent.quote?.payment
    const settle = entries.find(e => e.kind === 'settle' && e.intentId === intent.intentId && e.runId === b.runId)
    const refund = entries.find(e => e.kind === 'refund' && e.intentId === intent.intentId && e.runId === b.runId)
    const quoteOk = !!terms && row?.invoiceId === terms.invoiceId && intent.quote?.quoteHash === terms.invoiceId && (intent.escrow || ledgerInvoiceId(intent.quote!.quoteId) === terms.invoiceId)
    let invoiceOk = Boolean(intent.escrow && row?.escrowTerms && canonical(row.escrowTerms) === intent.quote?.quoteId && row.escrowState === intent.escrow.state && row.escrowTerms.manifestRoot === intent.quote?.contentDigest && row.escrowTerms.amount === amountFor(intent.amountMinor) && row.escrowTerms.payer === row.payer)
    if (!intent.escrow) try { const invoice = JSON.parse(intent.quote!.quoteId); invoiceOk = invoice.articleId === intent.resourceId && invoice.version === intent.version && invoice.payTo === row?.payee && invoice.amount === row?.amountDrops && invoice.manifestRoot === intent.quote!.contentDigest && canonical(invoice.asset ?? 'XRP') === canonical(row?.asset ?? 'XRP') } catch { /* invalid binding */ }
    const candidate = b.candidates.find(c => key(c) === key(intent) && c.profileId === intent.profileId)
    const manifest = candidate?.manifest
    const writerOk = candidate?.tier === 'PAID' && manifest && verifyManifestSignature(manifest) &&
      manifest.articleId === intent.resourceId && manifest.version === intent.version && manifest.publisherSlug === intent.profileId &&
      manifest.wallet === terms?.payTo && manifest.root === intent.quote?.contentDigest && manifest.priceMinor === intent.amountMinor
    const cancelled = intent.escrow?.state === 'CANCELLED'
    const chargedMinor = cancelled ? 0 : intent.amountMinor
    const destination = cancelled ? row?.payer : terms?.payTo
    const receiptOk = rows.length === 1 && receipt && (!intent.source || key(receipt) === key(intent)) && row.runId === b.runId &&
      row.writer === intent.profileId && row.resourceId === intent.resourceId && row.version === intent.version &&
      row.amountMinor === chargedMinor && receipt.amountMinor === chargedMinor && row.label === receipt.label &&
      row.status === intent.status && row.txHash === (receipt.xrpl?.txHash ?? intent.txHash) &&
      row.amountDrops === (cancelled ? '0' : amountFor(intent.amountMinor, terms?.asset)) &&
      row.payee === destination && writerOk && canonical(row.asset) === canonical(terms?.asset) && quoteOk && invoiceOk &&
      settle?.data.txHash === row.txHash && settle.data.amountMinor === row.amountMinor && settle.data.payTo === terms?.payTo &&
      (intent.escrow || entries.some(e => e.kind === 'sign' && e.intentId === intent.intentId && e.data.txHash === row.txHash))
    add(`receipt ${intent.intentId}`, Boolean(receiptOk), 'Quote, amount, asset, writer, invoice and audit settlement agree')
    add(`refund ${intent.intentId}`, Boolean(row && row.refundTxHash === (intent.refund?.txHash ?? '') && row.refundAmountMinor === (intent.refund?.amountMinor ?? '') && (!intent.refund || refund?.data.txHash === intent.refund.txHash && refund.data.amountMinor === intent.refund.amountMinor && refund.data.originalTxHash === row.txHash)), intent.refund ? 'Recorded refund matches audit; ledger confirmation requires --testnet' : 'No refund recorded')
  }
  add('receipt coverage', b.receipts.length === b.payments.filter(p => p.kind === 'purchase').length && b.receipts.every(r => b.intents.some(i => i.intentId === r.intentId)) && entries.filter(e => e.kind === 'settle' || e.kind === 'refund').every(e => b.payments.some(p => p.intentId === e.intentId && (e.kind === 'refund' ? p.refundTxHash === e.data.txHash : p.txHash === e.data.txHash))), 'Every charge/refund has its payment row; no omitted audit settlements')
  if (options.testnet) {
    const owned = options.ledger ? undefined : testnetLedger(testnetUrl())
    try {
      const found = [...await verifyOnTestnet(b.payments, options.ledger ?? owned!), ...await verifyEscrowEvents(entries, options.ledger ?? owned!)]
      for (const c of found) checks.push({ check: `testnet ${c.kind} ${c.intentId}`, status: c.status === 'ok' ? 'PASS' : c.status === 'skipped' ? 'SKIP' : 'FAIL', detail: c.detail })
      add('testnet coverage', b.payments.every(p => p.label === XRPL_LABEL), 'All payments must be real Testnet for full on-ledger verification; SIMULATED is not ledger proof')
    } catch { add('testnet', false, 'Read-only Testnet lookup unavailable') } finally { await owned?.close() }
  } else checks.push({ check: 'testnet', status: 'SKIP', detail: 'Payments/refunds NOT checked on ledger; add --testnet (read-only, no keys)' })
  return { ok: checks.every(c => c.status !== 'FAIL'), runId: b.runId, checks }
}

export function verificationText(result: VerificationResult): string {
  const groups = ['manifest ', 'passages ', 'citation ', 'grant ', 'receipt ', 'refund ', 'audit chain', 'testnet ']
  const lines = [`VERIFY ${result.runId ?? 'report'}`]
  for (const prefix of groups) {
    const checks = result.checks.filter(c => c.check.startsWith(prefix))
    if (checks.length) lines.push(`${checks.some(c => c.status === 'FAIL') ? 'FAIL' : checks.every(c => c.status === 'SKIP') ? 'SKIP' : 'PASS'} ${prefix.trim().toUpperCase().padEnd(10)} ${checks.filter(c => c.status === 'PASS').length}/${checks.length}`)
  }
  for (const c of result.checks.filter(c => c.status !== 'PASS')) lines.push(`${c.status.padEnd(4)} ${c.check}: ${c.detail}`)
  lines.push(`RESULT ${result.ok ? 'PASS' : 'FAIL'}`)
  return lines.join('\n')
}
export { ReceiptBundleSchema, sha256 }
export type { ReceiptBundle }

function entriesForOrigin(b: ReceiptBundle, intentId: string, identity: string, kind = 'reserve'): boolean {
  return b.audit.entries.some(e => !('commitment' in e) && e.kind === kind && e.intentId === intentId && e.data.source && sourceKey({ source: e.data.source as NonNullable<ReceiptBundle['sources'][number]['source']>, resourceId: String(e.data.resourceId), version: String(e.data.version) }) === identity)
}
