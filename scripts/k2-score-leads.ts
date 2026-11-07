// Reconstruct displayed purchased leads from exported receipts; canonical scorer is unchanged.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { leadFinding } from '../shared/lead-finding.js'
import { sameSource } from '../shared/source-identity.js'
import { answersIt } from './judge-bank-scorer.js'
import type { ReceiptBundle } from '../shared/contracts/index.js'
const dir = resolve(process.argv[2])
const select: typeof leadFinding = process.argv[3] ? (await import(pathToFileURL(resolve(process.argv[3])).href)).leadFinding : leadFinding
const data = JSON.parse(readFileSync(join(dir, 'results.json'), 'utf8'))
const results = data.results.map((q: { id: string; question: string; gold?: string }) => {
 const bundle = JSON.parse(readFileSync(join(dir, `${q.id}.receipts.json`), 'utf8')) as ReceiptBundle
 const claims = bundle.answers.at(-1)?.claims ?? []
 const paid = claims.filter(c => c.citations.some(ref => bundle.intents.some(i => i.status === 'VERIFIED' && sameSource(i, ref))))
 const citations = paid.flatMap(c => c.citations).filter(ref => bundle.sources.some(s => sameSource(s, ref) && s.spans.some(p => p.id === ref.spanId && s.body.includes(p.text))))
 const lead = select(q.question, paid.length ? paid : claims, bundle.sources).map(l => ({ text: l.text, citations: l.claim.citations }))
 return { id: q.id, gold: q.gold, lead, answersIt: answersIt(q.gold, lead, citations) }
})
writeFileSync(join(dir, 'display-scoring.json'), JSON.stringify({ artifactSha256: data.artifactSha256, bankSha256: data.bankSha256, answersIt: { n: results.filter(r => r.answersIt).length, N: results.filter(r => r.gold?.trim()).length }, results }, null, 2) + '\n')
