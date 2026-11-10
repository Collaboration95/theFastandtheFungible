// Development replay: re-select the lead of every saved K5 measurement run from
// its delivered contents, candidates and first requirement, without re-running the
// engine, so lead-selection changes can be compared in seconds. Pure, offline.
// Usage: tsx scripts/k5-replay-leads.ts <measure-output-dir> [bank ...] [--json out.json] [--explain bank-ID ...]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { summarizeAnswer, onTopic } from '../shared/answer-summary.js'
import { rankLeadSentences } from '../shared/lead-finding.js'
import { sameSource } from '../shared/source-identity.js'
import { answersIt } from './judge-bank-scorer.js'

const args = process.argv.slice(2)
const jsonAt = args.includes('--json') ? args[args.indexOf('--json') + 1] : undefined
const explain = new Set(args.includes('--explain') ? args.slice(args.indexOf('--explain') + 1).filter(a => !a.startsWith('--')) : [])
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--json' && !(args.includes('--explain') && i > args.indexOf('--explain')))
const dir = resolve(positional[0] ?? '.')
const only = new Set(positional.slice(1))
const rows: Record<string, unknown>[] = []
for (const file of readdirSync(dir).filter(f => /^(?:v|uc|presets)[\w-]*\.json$/.test(f) && f !== 'summary.json').sort()) {
  const bank = file.replace(/-[A-Za-z]+\d+\.json$/, '')
  if (only.size && !only.has(bank)) continue
  const { result, run } = JSON.parse(readFileSync(join(dir, file), 'utf8'))
  const answer = { claims: [], conclusion: '', openGaps: [], version: 1, provider: 'fixture', model: 'replay' }
  const lead = summarizeAnswer(run.question, answer, run.contents, run.candidates, run.checkpoint?.requirements?.[0]?.text).lead ?? []
  const paid = run.intents.filter((i: { status: string }) => i.status === 'VERIFIED')
  const cites = lead.flatMap(l => l.claim.citations).filter(ref => paid.some((i: object) => sameSource(i as never, ref)))
  const score = answersIt(result.gold, lead.map(l => ({ text: l.text, citations: l.claim.citations })), cites)
  if (explain.has(`${bank}-${result.id}`)) {
    const topical = run.contents.filter((c: never) => onTopic(run.question, c, run.candidates))
    const extracts = topical.flatMap((c: { spans: { id: string; text: string }[]; source?: unknown; resourceId: string; version: string }) => c.spans.map(sp => ({ id: `x-${c.resourceId}-${sp.id}`, text: sp.text, stance: 'UNCERTAIN' as const, citations: [{ resourceId: c.resourceId, version: c.version, spanId: sp.id }] })))
    console.log(`## ${bank}-${result.id} gold=${result.gold} Q: ${run.question}`)
    for (const [i, r] of rankLeadSentences(run.question, extracts as never, topical, run.checkpoint?.requirements?.[0]?.text, run.candidates).entries()) {
      const g = result.gold && r.text.toLowerCase().replace(/\s+/g, ' ').includes(String(result.gold).toLowerCase()) ? ' <GOLD>' : ''
      if (i < 8 || g) console.log(`  #${i + 1} ${r.score.toFixed(1)} [${r.claim.citations[0].resourceId}/${r.claim.citations[0].spanId}]${g} ${r.text.slice(0, 160)}`)
    }
  }
  const saved = (result.lead ?? []).map((l: { text: string }) => l.text)
  rows.push({ bank, id: result.id, gold: result.gold, expect: result.expect, question: run.question, buyAndCite: result.buyAndCite, answersIt: result.gold ? score : undefined, savedAnswersIt: result.answersIt, lead: lead.map(l => l.text), changedFromSaved: JSON.stringify(saved) !== JSON.stringify(lead.map(l => l.text)) })
}
const per: Record<string, { n: number; answersIt: number; buyAndCite: number; changed: number }> = {}
for (const r of rows as { bank: string; answersIt?: number; buyAndCite: boolean; changedFromSaved: boolean }[]) {
  const b = (per[r.bank] ??= { n: 0, answersIt: 0, buyAndCite: 0, changed: 0 })
  b.n++; b.answersIt += r.answersIt ?? 0; b.buyAndCite += r.buyAndCite ? 1 : 0; b.changed += r.changedFromSaved ? 1 : 0
}
if (jsonAt) writeFileSync(jsonAt, JSON.stringify({ per, rows }, null, 2))
for (const r of rows as { bank: string; id: string; answersIt?: number; lead: string[]; gold?: string; changedFromSaved: boolean }[]) {
  if (process.env.REPLAY_QUIET !== '1') console.log(r.bank, r.id, r.answersIt ?? '-', r.changedFromSaved ? 'CHANGED' : 'same', JSON.stringify(r.lead).slice(0, 260))
}
console.log(JSON.stringify(per))
