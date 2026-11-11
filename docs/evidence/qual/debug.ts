import{runLiveShaped}from'../../../tests/fixtures/r9-live-shaped.js'
import{fixturePlan}from'../../../server/agents/scope.js'
import{writeFileSync}from'node:fs'
const qs=['Can the language model in ResearchAgent spend money on its own?','Which transactions finish or cancel an XRPL escrow?','What transactions release or return an XRPL escrow?']
const r=await runLiveShaped(qs.map((question,i)=>({id:String(i),question,budgetMinor:200,modal:{...fixturePlan(question),requirements:[]},run:{...fixturePlan(question),requirements:[]},observed:{bought:[],spentMinor:0,lead:[]}})))
writeFileSync('/tmp/qual-debug.json',JSON.stringify(r,null,2));console.log(r.map(x=>({q:x.question,bought:x.bought,lead:x.lead,gaps:x.openGaps,decisions:x.decisions.map(d=>({gap:d.gap,rows:d.rows.filter(r=>r.id==='product-how-it-decides'||r.id.includes('escrow')).map(r=>({id:r.id,verdict:r.verdict,reason:r.reason}))}))})))
