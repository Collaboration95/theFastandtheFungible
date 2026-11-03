import { json } from './common.mjs'
import { refresh } from '../../site/ledger/ledger.js'
const started=Date.now(), rows=json('site/ledger/transactions.json').rows, results=[]
// Overall watchdog keeps even three unavailable endpoints under 30 seconds.
const timer=setTimeout(()=>{console.error('Read-only verification exceeded 29 seconds');process.exit(1)},29000)
const endpointComparison = await Promise.all(['https://testnet.xrpl-labs.com/', 'https://s.altnet.rippletest.net:51234/', 'https://clio.altnet.rippletest.net:51234/'].map(async endpoint => {
 try {
  const response = await fetch(endpoint, {method:'POST', headers:{'Content-Type':'application/json', Origin:'https://collaboration95.github.io'}, body:JSON.stringify({method:'tx',params:[{transaction:rows[0].hash,binary:false,api_version:2}]}), signal:AbortSignal.timeout(5000)})
  const body = await response.json()
  return {endpoint, cors:response.headers.get('access-control-allow-origin'), error:body.result?.error, validated:body.result?.validated, result:body.result?.meta?.TransactionResult}
 } catch(error) { return {endpoint, error:error.message} }
}))
await refresh(rows,WebSocket,(hash,status)=>results.push({hash,status}))
clearTimeout(timer)
console.log(JSON.stringify({observedAt:new Date().toISOString(),elapsedMs:Date.now()-started,validated:results.filter(r=>r.status.startsWith('validated')).length,total:rows.length,endpointComparison,results},null,2))
if(!results.some(r=>r.status.startsWith('validated'))) process.exitCode=1
