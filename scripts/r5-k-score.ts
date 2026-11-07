import { leadFinding } from '../shared/lead-finding.js'
import { dirname, join } from 'node:path'
import type { ReceiptBundle } from '../shared/contracts/index.js'
// Literal answers-it measurement; never changes the bank, policy, or gold phrases.
import { readFileSync, writeFileSync } from 'node:fs'
const file = process.argv[2]
const data = JSON.parse(readFileSync(file, 'utf8'))
const v1 = JSON.parse(readFileSync('docs/evidence/r5-k/v1-gold.json', 'utf8')).gold
for (const r of data.results) {
 const bundle = JSON.parse(readFileSync(join(dirname(file), r.id + '.receipts.json'), 'utf8')) as ReceiptBundle
 r.capturedLead ??= r.lead
 r.lead = leadFinding(r.question, bundle.answers.at(-1)?.claims.filter(c => c.citations.some(ref => bundle.intents.some(i => i.status === 'VERIFIED' && i.resourceId === ref.resourceId))) ?? [], bundle.sources).map(l => ({text:l.text,citations:l.claim.citations}))
 const firstTwo = r.lead.map((l: {text:string})=>l.text).join(' ').split(/(?<=[.!?])\s+(?=[A-Z])/).slice(0,2).join(' ')
 r.measuredGold = r.gold ?? v1[r.id]
 r.answersIt = !!r.measuredGold && firstTwo.toLowerCase().includes(r.measuredGold.toLowerCase()) && r.buyAndCite && r.lead.some((l: {citations:unknown[]})=>l.citations.length)
}
const summary = { answersIt:data.results.filter((r:{answersIt:boolean})=>r.answersIt).length, total:data.results.length, buyAndCite:data.results.filter((r:{buyAndCite:boolean})=>r.buyAndCite).length, gateViolations:data.results.reduce((sum:number,r:{violations:unknown[]})=>sum+r.violations.length,0), verificationPass:data.results.filter((r:{verificationOk:boolean})=>r.verificationOk).length }
writeFileSync(file,JSON.stringify({...data,summary},null,2)+'\n')
console.log(summary)
