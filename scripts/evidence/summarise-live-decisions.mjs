// LIVE-DEC: summarises scripts/evidence/live-decisions.ts raw results into per-arm metrics and Markdown tables.
//   node scripts/evidence/summarise-live-decisions.mjs <raw-results.json> [summary.json]
// The gold (right article ids, lead pattern) is the harness's own GOLD table, repeated here so the summary can be re-run
// on a committed raw file without the harness.
import { readFileSync, writeFileSync } from 'node:fs'

const [input, output] = process.argv.slice(2)
if (!input) throw Error('Usage: node scripts/evidence/summarise-live-decisions.mjs <raw-results.json> [summary.json]')
const raw = JSON.parse(readFileSync(input, 'utf8'))
const GOLD = {
  XRPL2: { right: ['product-x402-response'], lead: /PAYMENT-REQUIRED|scheme, network, amount|payTo/i },
  XRPL1: { right: ['team-rlusd'], lead: /AllowTrustLineLocking/i },
  XRPL3: { right: ['xrpl-reserves'], lead: /\b\d+(?:\.\d+)?\s*XRP\b|base reserve/i },
  A3: { right: ['team-fees'], lead: /\b\d[\d,]*\s*drops\b/i },
  A4: { right: ['c5-xrpl-token-escrow-xls85'], lead: /TokenEscrow|XLS-85/i },
  A5: { right: ['xrpl-escrow', 'xrpl-tx-escrowfinish', 'xrpl-tx-escrowcancel', 'product-escrow-no-show'], lead: /EscrowFinish[\s\S]*EscrowCancel|EscrowCancel[\s\S]*EscrowFinish/ },
  D1: { right: ['c5-fatf-recommendation-16-travel-rule', 'xrpl-compliance-fatf-travel-rule'], lead: /originator|beneficiary/i },
  D3: { right: ['c5-mas-licence-paying-suppliers-rlusd'], lead: /licen[cs]e/i },
  D4: { right: ['product-escrow-no-show'], lead: /EscrowCancel|CancelAfter|cancel/i },
  E5: { right: [], none: true },
  B5: { right: ['product-how-it-decides'], lead: /decid|worth buying|two steps/i },
  C1: { right: ['product-writer-paid'], lead: /key/i },
  C4: { right: ['product-writer-earnings'], lead: /S\$0\.40|full price|40,000 drops|fee/i },
}
const gold = row => GOLD[row.id] ?? { right: [], none: true }
const pct = (values, p) => { if (!values.length) return null; const s = [...values].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1)] }
const sec = ms => ms === null ? 'n/a' : `${(ms / 1000).toFixed(1)} s`
const sgd = minor => `S$${(minor / 100).toFixed(2)}`
// Wall time the run spent waiting on decision calls: the union of the call intervals is not recorded, so parallel chunk
// requests are counted once per round by taking the longest call of each consecutive same-kind group.
function decisionWait(calls) {
  let total = 0, group = []
  const flush = () => { if (group.length) total += Math.max(...group.map(c => c.ms)); group = [] }
  for (const call of calls) { if (group.length && (group[0].kind !== call.kind || call.kind !== 'candidates')) flush(); group.push(call) }
  flush()
  return total
}
function score(row) {
  const g = gold(row), bought = row.bought ?? [], lead = (row.lead ?? []).join(' ')
  const decisionFailure = (row.fallbacks ?? []).some(f => f.type === 'DECISION_UNAVAILABLE')
  return {
    ran: !!row.runId, done: row.phase === 'DONE', failed: row.phase === 'FAILED', decisionFailure,
    articles: bought.length, spentMinor: row.spentMinor ?? 0,
    rightFirst: g.none ? bought.length === 0 : g.right.includes(bought[0]),
    rightAny: g.none ? bought.length === 0 : bought.some(id => g.right.includes(id)),
    offTarget: g.none ? bought.length : bought.filter(id => !g.right.includes(id)).length,
    leadAnswers: g.none ? null : !!g.lead && g.lead.test(lead),
    declineCorrect: g.none ? bought.length === 0 : null,
    researchFallback: (row.fallbacks ?? []).some(f => f.type === 'MODEL_FALLBACK'),
    refusals: row.meter?.refusals ?? [],
  }
}
const arms = [...new Set(raw.results.map(r => r.arm))]
const sets = ['presets', 'judges', 'negatives']
const summary = { source: input, startedAt: raw.startedAt, arms: {}, perQuestion: {}, openaiUsdUpperBound: raw.openaiUsdUpperBound, proxy: raw.proxy }
for (const arm of arms) {
  const rows = raw.results.filter(r => r.arm === arm)
  const by = {}
  for (const set of ['all', ...sets]) {
    const subset = rows.filter(r => set === 'all' || r.set === set), scored = subset.map(score)
    const answerable = scored.filter((s, i) => !gold(subset[i]).none), negatives = scored.filter((s, i) => gold(subset[i]).none)
    const calls = subset.flatMap(r => r.decisionCalls ?? [])
    const ok = calls.filter(c => c.status === 'ok')
    by[set] = {
      questions: subset.length, ran: scored.filter(s => s.ran).length, done: scored.filter(s => s.done).length, failed: scored.filter(s => s.failed).length,
      decisionFailures: scored.filter(s => s.decisionFailure).length,
      researchFallbacks: scored.filter(s => s.researchFallback).length,
      articles: scored.reduce((n, s) => n + s.articles, 0), spentMinor: scored.reduce((n, s) => n + s.spentMinor, 0),
      articlesPerQuestion: subset.length ? +(scored.reduce((n, s) => n + s.articles, 0) / subset.length).toFixed(2) : 0,
      answerable: answerable.length,
      rightFirst: answerable.filter(s => s.rightFirst).length, rightAny: answerable.filter(s => s.rightAny).length,
      offTargetArticles: answerable.reduce((n, s) => n + s.offTarget, 0),
      leadAnswers: answerable.filter(s => s.leadAnswers).length,
      declines: negatives.length, declineCorrect: negatives.filter(s => s.declineCorrect).length, negativeArticles: negatives.reduce((n, s) => n + s.articles, 0),
      decisionCalls: calls.length, decisionCallErrors: calls.filter(c => c.status !== 'ok').map(c => c.status),
      decisionCallMs: { p50: pct(ok.map(c => c.ms), 50), p95: pct(ok.map(c => c.ms), 95), max: ok.length ? Math.max(...ok.map(c => c.ms)) : null },
      decisionWaitPerRunMs: { p50: pct(subset.filter(r => r.runId && arm !== 'fixture').map(r => decisionWait(r.decisionCalls ?? [])), 50), p95: pct(subset.filter(r => r.runId && arm !== 'fixture').map(r => decisionWait(r.decisionCalls ?? [])), 95) },
      totalMs: { p50: pct(subset.map(r => r.totalMs).filter(Number.isFinite), 50), p95: pct(subset.map(r => r.totalMs).filter(Number.isFinite), 95) },
      runMs: { p50: pct(subset.map(r => r.runMs).filter(Number.isFinite), 50), p95: pct(subset.map(r => r.runMs).filter(Number.isFinite), 95) },
      openaiInputTokens: ok.reduce((n, c) => n + (c.inputTokens ?? 0), 0), openaiOutputTokens: ok.reduce((n, c) => n + (c.outputTokens ?? 0), 0),
      peakReservedUsd: { p50: (pct(subset.map(r => r.meter?.peakMicro ?? 0), 50) ?? 0) / 1e6, max: Math.max(0, ...subset.map(r => r.meter?.peakMicro ?? 0)) / 1e6 },
      peakDecisionInputEstimate: { p50: pct(subset.map(r => r.meter?.peakDecisionInputTokens ?? 0), 50), max: Math.max(0, ...subset.map(r => r.meter?.peakDecisionInputTokens ?? 0)) },
      settledModelUsdPerQuestion: subset.some(r => r.runId) ? +(subset.reduce((n, r) => n + (r.meter?.byProvider ?? []).reduce((m, p) => m + p.micro, 0), 0) / subset.filter(r => r.runId).length / 1e6).toFixed(5) : 0,
      settledDecisionUsdPerQuestion: subset.length ? +(subset.reduce((n, r) => n + (r.meter?.byProvider ?? []).filter(p => p.provider === 'decision').reduce((m, p) => m + p.micro, 0), 0) / Math.max(1, subset.filter(r => r.runId).length) / 1e6).toFixed(5) : 0,
      refusals: subset.flatMap(r => r.meter?.refusals ?? []).reduce((m, code) => ({ ...m, [code]: (m[code] ?? 0) + 1 }), {}),
      chip: [...new Set(subset.map(r => r.chipModels).filter(Boolean))],
      decisionLabels: [...new Set(subset.map(r => r.labels?.decision).filter(Boolean))],
    }
  }
  summary.arms[arm] = by
}
for (const row of raw.results) {
  const key = `${row.id}`, s = score(row)
  summary.perQuestion[key] ??= { id: row.id, set: row.set, question: row.question, runs: {} }
  ;(summary.perQuestion[key].runs[row.arm] ??= []).push({ rep: row.rep, phase: row.phase ?? row.outcome, bought: row.bought ?? [], spent: sgd(row.spentMinor ?? 0), lead: (row.lead ?? [])[0] ?? '', rightFirst: s.rightFirst, leadAnswers: s.leadAnswers, decisionFailure: s.decisionFailure, totalMs: row.totalMs, error: row.error ?? null })
}
if (output) writeFileSync(output, JSON.stringify(summary, null, 1) + '\n')

// Markdown
const line = cells => `| ${cells.join(' | ')} |`
const out = []
out.push(line(['Metric', ...arms]), line(['---', ...arms.map(() => '---')]))
const a = set => arms.map(arm => summary.arms[arm][set])
const row = (label, f, set = 'all') => out.push(line([label, ...a(set).map(f)]))
row('Runs (DONE / FAILED)', m => `${m.ran} (${m.done} / ${m.failed})`)
row('Runs ended "Decision model unavailable"', m => String(m.decisionFailures))
row('Answerable: right article bought first', m => `${m.rightFirst}/${m.answerable}`)
row('Answerable: right article bought at all', m => `${m.rightAny}/${m.answerable}`)
row('Answerable: articles off the gold list', m => String(m.offTargetArticles))
row('Answerable: lead matches key-fact pattern (not full completeness)', m => `${m.leadAnswers}/${m.answerable}`)
row('Should decline (E5 + v5 negatives): bought nothing', m => `${m.declineCorrect}/${m.declines}`)
row('Articles per question', m => m.articlesPerQuestion.toFixed(2))
row('Spend (all questions)', m => sgd(m.spentMinor))
row('Decision call latency p50 / p95', m => m.decisionCalls ? `${sec(m.decisionCallMs.p50)} / ${sec(m.decisionCallMs.p95)}` : 'in-process')
row('Estimated decision wait per run p50 / p95', m => m.decisionCalls ? `${sec(m.decisionWaitPerRunMs.p50)} / ${sec(m.decisionWaitPerRunMs.p95)}` : 'in-process')
row('End-to-end (scope + run) p50 / p95', m => `${sec(m.totalMs.p50)} / ${sec(m.totalMs.p95)}`)
row('Decision call errors', m => m.decisionCallErrors.length ? Object.entries(m.decisionCallErrors.reduce((o, e) => ({ ...o, [e]: (o[e] ?? 0) + 1 }), {})).map(([k, v]) => `${v}× ${k}`).join(', ') : '0')
row('Hosted meter refusals', m => Object.keys(m.refusals).length ? Object.entries(m.refusals).map(([k, v]) => `${v}× ${k}`).join(', ') : '0')
row('Peak decision input estimate per question (cap 50,000)', m => `${m.peakDecisionInputEstimate.max ?? 0}`)
row('Peak model reservation per question (cap US$0.05)', m => `US$${m.peakReservedUsd.max.toFixed(4)}`)
row('Settled decision cost per started run (configured rates)', m => `US$${m.settledDecisionUsdPerQuestion.toFixed(4)}`)
row('Settled model cost per started run, all providers (configured rates)', m => `US$${m.settledModelUsdPerQuestion.toFixed(4)}`)
row('Research writer fell back to extracts', m => String(m.researchFallbacks))
out.push('')
for (const set of sets) {
  out.push(`**${set}**`, '', line(['Metric', ...arms]), line(['---', ...arms.map(() => '---')]))
  row('Runs (DONE / FAILED)', m => `${m.ran} (${m.done} / ${m.failed})`, set)
  if (set !== 'negatives') {
    row('Right article first', m => `${m.rightFirst}/${m.answerable}`, set)
    row('Lead matches key-fact pattern (not full completeness)', m => `${m.leadAnswers}/${m.answerable}`, set)
  }
  row('Bought nothing when it should', m => `${m.declineCorrect}/${m.declines}`, set)
  row('Articles / spend', m => `${m.articles} / ${sgd(m.spentMinor)}`, set)
  row('End-to-end p50 / p95', m => `${sec(m.totalMs.p50)} / ${sec(m.totalMs.p95)}`, set)
  out.push('')
}
out.push(line(['Question', 'Rep', ...arms]), line(['---', '---', ...arms.map(() => '---')]))
for (const q of Object.values(summary.perQuestion)) {
  const reps = Math.max(...arms.map(arm => (q.runs[arm] ?? []).length))
  for (let i = 0; i < reps; i++) {
    out.push(line([i ? '' : q.id, String(i + 1), ...arms.map(arm => {
      const r = (q.runs[arm] ?? [])[i]
      if (!r) return ''
      const mark = r.decisionFailure ? ' ⚠ decision unavailable' : r.phase !== 'DONE' ? ` (${r.phase})` : ''
      return `${r.bought.length ? r.bought.join(', ') : 'nothing'} · ${r.spent}${r.leadAnswers === null ? '' : r.leadAnswers ? ' · lead ✓' : ' · lead ✗'}${mark}`
    })]))
  }
}
console.log(out.join('\n'))
