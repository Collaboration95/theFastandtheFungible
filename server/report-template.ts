import { decisionLabel, type Claim, type Report } from '../shared/contracts/index.js'
import { articleUrl } from '../shared/contracts/manifest.js'
import { resolveCitation } from './agents/citations.js'
import { leadFinding } from '../shared/lead-finding.js'

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const money = (minor: number) => `S$${(minor / 100).toFixed(2)}`
const key = (ref: { resourceId: string; version: string; spanId: string }) => JSON.stringify([ref.resourceId, ref.version, ref.spanId])
export const reportEnvironment = (report: Report) => report.labels?.settlement.includes('TESTNET') ? 'XRPL Testnet · test funds' : 'Demo data · simulated payments'

/** Offline, escaped print view: two content sections and cited passages exactly once. */
export function reportHtml(report: Report): string {
  const findings = report.finalFindings ?? report.findings
  const references = new Map<string, { n: number; source: Report['sources'][number]; span: Report['sources'][number]['spans'][number] }>()
  // Same numbering as the app: first answer then final answer, even for dropped passages.
  const numbers = new Map<string, number>()
  for (const claim of [...(report.firstFindings ?? []), ...findings]) for (const ref of claim.citations) if (!numbers.has(key(ref))) numbers.set(key(ref), numbers.size + 1)
  const cite = (claim: Claim) => claim.citations.map(ref => {
    const span = resolveCitation(ref, report.sources)
    const source = report.sources.find(s => s.resourceId === ref.resourceId && s.version === ref.version)
    if (!span || !source) throw new Error('Unresolved report citation')
    const n = numbers.get(key(ref))!
    references.set(key(ref), { n, source, span })
    return `<a href="#excerpt-${n}"><sup>[${n}]</sup></a>`
  }).join(' ')
  const lead = leadFinding(report.question, findings).map(item => `${escape(item.text)} ${cite(item.claim)}`).join(' ')
  const groups = [['SUPPORTS','Supports'],['CHALLENGES','Disputes'],['UNCERTAIN','Unclear']].map(([stance, name]) => {
    const items = findings.filter(c => c.stance === stance)
    return items.length ? `<h3>${name} (${items.length})</h3><ul>${items.map(c => `<li>${escape(leadFinding(report.question, [c])[0]?.text ?? c.text)} ${cite(c)}</li>`).join('')}</ul>` : ''
  }).join('')
  const refunds = (report.refunds ?? []).reduce((sum,r) => sum + r.amountMinor, 0)
  const candidate = (id: string, version: string) => report.access?.candidates.find(c => c.resourceId === id && c.version === version)
  const payments = report.receipts.map(r => {
    const source = candidate(r.resourceId, r.version)
    const refund = report.refunds?.find(item => item.intentId === r.intentId)
    return `<tr><td>${escape(source?.publisher ?? r.resourceId)}<br><small>${escape(source?.title)}</small></td><td>${money(r.amountMinor)}</td><td>${refund ? `Refunded ${money(refund.amountMinor)} · ${reportEnvironment(report)}` : 'Paid'}</td><td>${r.xrpl ? `<a href="${escape(r.xrpl.explorerUrl)}">${escape(r.xrpl.txHash)}</a>` : 'None (simulated)'}</td></tr>`
  }).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escape(report.title)}</title><style>
@page { size: A4; margin: 16mm 18mm 20mm; }
* { box-sizing: border-box; } body { margin: 0; color: #24211E; background: white; font: 14px/1.5 Arial,sans-serif; } main { max-width: 760px; margin: auto; } h1 { font-size: 24px; line-height: 1.25; margin: 8px 0 20px; } h2 { font-size: 20px; margin: 0 0 14px; } h3 { font-size: 14px; margin: 18px 0 8px; } p { margin: 10px 0; } .caption,small { color: #655D55; font-size: 12px; } .lead { font-size: 18px; line-height: 1.5; } table { border-collapse: collapse; width: 100%; font-size: 12px; } td:nth-child(2),th:nth-child(2) { min-width: 68px; white-space: nowrap; } td:nth-child(4),th:nth-child(4) { min-width: 90px; } td,th { text-align: left; vertical-align: top; border-bottom: 1px solid #E8E2D8; padding: 8px 4px; overflow-wrap: anywhere; } th { font-weight: 600; } .environment { border-left: 2px solid #9A6B20; background: #FBF8F2; padding: 12px; font-size: 12px; } a { color: inherit; } ul { padding-left: 18px; } li { margin: 0 0 12px; } blockquote { margin: 8px 0 20px; padding-left: 12px; border-left: 2px solid #C9BFB2; } .excerpt { margin-bottom: 20px; } .excerpt h3 { margin-bottom: 4px; } .claims { break-before: page; } .appendix { break-before: page; } .footer { color: #655D55; font-size: 11px; margin-top: 20px; } .print-note { font-size: 12px; } @media print { body { font-size: 10pt; } h1,h2,h3 { break-after: avoid; } tr { break-inside: avoid; } .print-note,.footer { display: none; } a { text-decoration: none; } }
</style></head><body><main><p class="print-note">Print this HTML page or save it as PDF.</p><section><p class="caption">ResearchAgent evidence report</p><h1>${escape(report.question)}</h1><h2>Lead finding</h2><p class="lead">${lead || 'No validated finding is available.'}</p><h3>Spend</h3><table><thead><tr><th>Paid</th><th>Refunded</th><th>Net cost</th><th>Budget</th></tr></thead><tbody><tr><td>${money(report.spentMinor)}</td><td>${money(refunds)}</td><td>${money(Math.max(0,report.spentMinor-refunds))}</td><td>${money(report.budgetMinor)}</td></tr></tbody></table><h3>Payments</h3><table><thead><tr><th>Writer / article</th><th>Amount</th><th>Status</th><th>Transaction</th></tr></thead><tbody>${payments || '<tr><td colspan="4">Answered from free sources. No purchases.</td></tr>'}</tbody></table><p class="environment">${escape(report.disclaimer)}<br>${reportEnvironment(report)}. All writers and articles are fictional.<br>Research: ${escape(report.labels?.research)}. ${report.decisions.map(d => `Decided by ${escape(decisionLabel(d))}`).join('; ')}${report.fallbackReason ? '<br>Written from offline extracts: the model was unavailable.' : ''}</p>${report.facts ? `<p class="caption">Requested facts: ${escape(report.facts.line)}<br>${report.facts.facts.map(f => `${escape(f.status)} · ${escape(f.text)}`).join('<br>')}</p>` : ''}<p class="caption">How to read this: citation numbers link to exact delivered passages in the appendix. Refunds do not restore spending authority.</p></section><section class="claims"><h2>Claims</h2>${groups}${report.openQuestions.length ? `<h3>Still unanswered</h3><ul>${report.openQuestions.map(q => `<li>${escape(q)}</li>`).join('')}</ul>` : ''}</section><section class="appendix"><h2>Appendix · cited passages</h2>${[...references.values()].sort((a,b) => a.n-b.n).map(({ n, source, span }) => {
    const c = candidate(source.resourceId,source.version)
    const url = c?.publisherSlug ? articleUrl(c.publisherSlug,source.resourceId,c.tier === 'FREE' ? span.id : undefined) : undefined
    return `<div class="excerpt" id="excerpt-${n}"><h3>[${n}] ${escape(source.title)}</h3><p class="caption">${escape(source.publisher)} · ${c?.tier === 'PAID' ? 'bought / granted' : 'free'} · ${escape(c?.license.attribution)}<br>Receipt IDs: ${escape(report.receipts.filter(r => r.resourceId === source.resourceId && r.version === source.version).map(r => r.receiptId).join(', ') || 'none')}${url ? ` · <a href="${escape(url)}">Writer’s article</a>` : ''}</p><p class="caption">Exact synthetic passage · ${escape(span.id)}</p><blockquote>${escape(span.text)}</blockquote></div>`
  }).join('')}</section><p class="footer">${reportEnvironment(report)}</p></main></body></html>`
}
