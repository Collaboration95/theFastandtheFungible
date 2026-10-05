import { providerLabels, type Claim, type Report } from '../shared/contracts/index.js'
import { resolveCitation } from './agents/citations.js'

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const money = (minor: number) => `S$${(minor / 100).toFixed(2)}`
const refKey = (resourceId: string, version: string, spanId: string) => JSON.stringify([resourceId, version, spanId])

/** One offline, escaped template for both Chromium PDF and browser printing. */
export function reportHtml(report: Report): string {
  const references = report.sources.flatMap(source => source.spans.map(span => ({ source, span })))
  const referenceNumber = (resourceId: string, version: string, spanId: string) => references.findIndex(r => refKey(r.source.resourceId, r.source.version, r.span.id) === refKey(resourceId, version, spanId)) + 1
  const claims = (items: Claim[]) => items.map(claim => `<li><p>${escape(claim.text)} <strong>${escape(claim.stance)}</strong> ${claim.citations.map(ref => {
    if (!resolveCitation(ref, report.sources)) throw new Error('Unresolved report citation')
    const n = referenceNumber(ref.resourceId, ref.version, ref.spanId)
    return `<a href="#excerpt-${n}">[${n}]</a>`
  }).join(' ')}</p></li>`).join('')
  const decisions = report.decisions.map(round => `<h3>Round ${round.round} · ${escape(round.provider)} ${escape(round.model)}</h3><p>Gap: ${escape(round.gap)} · material probability ${round.gapMaterial.toFixed(3)} · threshold ${round.threshold.toFixed(3)}${round.fallbackReason ? ` · fallback: ${escape(round.fallbackReason)}` : ''}</p><table><thead><tr><th>Candidate / price</th><th>Gap / original / credibility</th><th>Value / per S$</th><th>Verdict</th></tr></thead><tbody>${round.rows.map(row => `<tr><td>${escape(row.candidate.title)}<br>${escape(row.candidate.resourceId)} · ${money(row.candidate.price.amountMinor)}</td><td>${row.judgment.addressesGap.toFixed(3)} / ${row.judgment.originality.original.toFixed(3)} / ${row.judgment.credibility.toFixed(3)}</td><td>${row.value.toFixed(3)} / ${row.valuePerDollar.toFixed(3)}</td><td>${escape(row.verdict)}${row.wouldBuy ? ' · would buy' : ''}<br>${escape(row.reason)}</td></tr>`).join('')}</tbody></table>`).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escape(report.title)}</title><style>
@page { size: A4; margin: 18mm; }
* { box-sizing: border-box; } body { margin: 0 auto; padding: 28px; max-width: 900px; color: #17212d; background: white; font: 16px/1.55 Georgia, serif; }
h1,h2,h3,th,.label { font-family: Arial, sans-serif; } h1 { font-size: 30px; line-height: 1.2; } h2 { font-size: 22px; margin-top: 28px; } h3 { font-size: 17px; } p,li,td,blockquote { overflow-wrap: anywhere; white-space: pre-wrap; } .label { border: 1px solid #637184; padding: 10px; font-size: 13px; } table { border-collapse: collapse; width: 100%; font: 12px/1.5 Arial,sans-serif; } th,td { padding: 8px; border: 1px solid #a3afbc; text-align: left; vertical-align: top; } thead { display: table-header-group; } blockquote { border-left: 3px solid #78889c; margin: 12px 0; padding-left: 16px; } a { color: #244a6b; } .excerpt { margin-bottom: 22px; } .print-note { font: 13px Arial,sans-serif; }
@media print { body { padding: 0; max-width: none; font-size: 11pt; } .appendix { break-before: page; } h1,h2,h3 { break-after: avoid; } tr,.excerpt { break-inside: avoid; } .print-note { display: none; } a { text-decoration: none; } }
</style></head><body><main>
<p class="print-note">Print this HTML page or save it as PDF with your browser. The appendix starts on a new printed page.</p>
<h1>${escape(report.title)}</h1><p>${escape(report.question)}</p>
<p class="label">${escape(report.disclaimer)}<br>Report: ${escape(providerLabels[report.provider])} · ${escape(report.model)}${report.fallbackReason ? `<br>Fixture fallback: ${escape(report.fallbackReason)}` : ''}<br>Research: ${escape(report.labels?.research ?? 'unspecified')} · Decision: ${escape(report.labels?.decision ?? 'unspecified')} · Publisher: ${escape(report.labels?.publisher ?? 'unspecified')}<br>SIMULATED SGD · no real funds</p>
<p>Budget ${money(report.budgetMinor)} · spent ${money(report.spentMinor)}</p>
<h2>Executive answer</h2><p>${escape(report.executiveAnswer)}</p>
<h2>Findings</h2><ol>${claims(report.findings)}</ol>
<h2>What purchases changed</h2><p>${escape(report.purchasesChanged)}</p>${report.impact ? `<p>Impact: <strong>${escape(report.impact.classification)}</strong></p>` : ''}
<h3>First answer · v${escape(report.firstVersion ?? '—')}</h3><ol>${claims(report.firstFindings ?? [])}</ol>
<h3>Final answer · v${escape(report.finalVersion ?? '—')}</h3><ol>${claims(report.finalFindings ?? [])}</ol>
<h2>Open questions</h2>${report.openQuestions.length ? `<ul>${report.openQuestions.map(q => `<li>${escape(q)}</li>`).join('')}</ul>` : '<p>No open questions recorded.</p>'}
<h2>Method</h2><p>${escape(report.method)}</p>
<section class="appendix"><h2>Appendix · decisions and receipts</h2><p>Ledger data from the persisted run; the writing model does not create these records.</p><p>value = gapMaterial × addressesGap × P(original) × (0.5 + 0.25 × credibility). Policy code enforces cap, budget and eligibility.</p>${decisions || '<p>No decision rounds recorded.</p>'}
<h3>Settlement receipts · ${escape(report.labels?.settlement ?? 'SIMULATED SGD · no real funds')}</h3>${report.receipts.length ? `<table><thead><tr><th>Receipt / intent</th><th>Resource / version</th><th>Amount / settled at</th></tr></thead><tbody>${report.receipts.map(r => `<tr><td>${escape(r.receiptId)}<br>${escape(r.intentId)}</td><td>${escape(r.resourceId)} · ${escape(r.version)}</td><td>${money(r.amountMinor)}${r.xrpl ? ` = ${escape(Number(r.xrpl.amountDrops) / 1_000_000)} XRP` : ''}<br>${escape(r.settledAt)}${r.xrpl ? `<br>XRPL tx <a href="${escape(r.xrpl.explorerUrl)}">${escape(r.xrpl.txHash.slice(0, 16))}…</a> · ledger ${r.xrpl.ledgerIndex}<br>${escape(r.xrpl.payer)} → ${escape(r.xrpl.payTo)}` : ''}</td></tr>`).join('')}</tbody></table>` : '<p>No settlements recorded.</p>'}
<h2>Source appendix · exact synthetic passages</h2>${report.sources.map(source => {
    const candidate = report.access?.candidates.find(c => c.resourceId === source.resourceId && c.version === source.version)
    const receipts = report.receipts.filter(r => r.resourceId === source.resourceId && r.version === source.version)
    return `<h3>${escape(source.title)}</h3><p>${escape(source.publisher)} · ${escape(source.resourceId)} · ${escape(source.version)} · ${candidate?.tier === 'PAID' ? 'bought / granted' : 'free'}<br>Receipt IDs: ${escape(receipts.map(r => r.receiptId).join(', ') || 'none')}<br>Attribution: ${escape(candidate?.license.attribution)}</p>${source.spans.map(span => {
      const n = referenceNumber(source.resourceId, source.version, span.id)
      return `<div class="excerpt" id="excerpt-${n}"><p>[${n}] Exact synthetic passage · span ${escape(span.id)}</p><blockquote>${escape(span.text)}</blockquote></div>`
    }).join('')}`
  }).join('') || '<p>No accessible sources recorded.</p>'}</section></main></body></html>`
}
