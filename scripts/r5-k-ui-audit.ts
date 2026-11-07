import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Answer from '../src/components/Answer.js'
import { Store } from '../server/store.js'
const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const store = new Store(process.argv[3])
let checked = 0
try {
 for (const result of data.results) {
  const run = store.getRun(result.runId)
  const html = renderToStaticMarkup(createElement(Answer, {run,view:'latest',onView:()=>{},compare:false,onCompare:()=>{}}))
  const groups = html.match(/<div class="ra-group"><h3>(?:Supports|Disputes)[\s\S]*?<\/ul><\/div>/g) ?? []
  for (const candidate of run.candidates.filter(c=>!c.resourceId.startsWith('team-'))) {
   const title = renderToStaticMarkup(createElement('span',null,candidate.title)).replace(/^<span>|<\/span>$/g,'')
   assert(!groups.some(group=>group.includes(title)), `${result.id}: unrelated source in Supports/Disputes`)
  }
  checked++
 }
 console.log(JSON.stringify({checked,fictionalSupportsOrDisputes:0}))
} finally { store.close() }
