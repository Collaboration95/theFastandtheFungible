// Literal answers-it measurement; never changes the bank, policy, or gold phrases.
import { leadFinding } from '../shared/lead-finding.js'
import { sameSource } from '../shared/source-identity.js'
import { answersIt } from './judge-bank-scorer.js'
import { dirname, join } from 'node:path'
import type { ReceiptBundle } from '../shared/contracts/index.js'
import { readFileSync, writeFileSync } from 'node:fs'
const file = process.argv[2]
const data = JSON.parse(readFileSync(file, 'utf8'))
const v1 = JSON.parse(readFileSync('docs/evidence/r5-k/v1-gold.json', 'utf8')).gold
for (const r of data.results) {
 const bundle = JSON.parse(readFileSync(join(dirname(file), r.id + '.receipts.json'), 'utf8')) as ReceiptBundle
 const claims = bundle.answers.at(-1)?.claims ?? []
 const purchasedCitations = claims.flatMap(c=>c.citations).filter(ref=>bundle.intents.some(i=>i.status==='VERIFIED' && sameSource(i,ref)))
 r.capturedLead ??= r.lead
 r.lead = leadFinding(r.question, claims.filter(c=>c.citations.some(ref=>purchasedCitations.some(p=>sameSource(p,ref) && p.spanId===ref.spanId))), bundle.sources).map(l=>({text:l.text,citations:l.claim.citations}))
 r.measuredGold = r.gold ?? v1[r.id]
 r.answersIt = !!answersIt(r.measuredGold,r.lead,purchasedCitations)
}
const summary = { answersIt:data.results.filter((r:{answersIt:boolean})=>r.answersIt).length, total:data.results.length, buyAndCite:data.results.filter((r:{buyAndCite:boolean})=>r.buyAndCite).length, gateViolations:data.results.reduce((sum:number,r:{violations:unknown[]})=>sum+r.violations.length,0), verificationPass:data.results.filter((r:{verificationOk:boolean})=>r.verificationOk).length }
writeFileSync(file,JSON.stringify({...data,summary},null,2)+'\n')
console.log(summary)
