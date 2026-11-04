import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { DEMO_QUESTIONS } from '../shared/contracts/examples.js'
const started = Date.now(), url = 'http://127.0.0.1:10588'
const headers = { Authorization: `Bearer ${process.env.RA_API_TOKEN}`, 'Content-Type': 'application/json' }
const request = async (path: string, body?: unknown) => { const r = await fetch(url + path, { headers, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) }); assert(r.ok); return r.json() }
for (;;) {
 try { await request('/health'); break } catch { if (Date.now() - started > 150000) throw Error('Devcontainer boot timeout'); await new Promise(r => setTimeout(r, 500)) }
}
const log = readFileSync('/tmp/researchagent-testnet.log', 'utf8')
mkdirSync('scratch/codespace-testnet', { recursive: true })
const fallback = log.match(/SIMULATED fallback · ([^\n]+)/)?.[1]
if (fallback) {
 const label = `SIMULATED fallback (${fallback})`
 console.log(`::warning::${label}`)
 writeFileSync('scratch/codespace-testnet/result.json', JSON.stringify({ label, bootSeconds: (Date.now() - started) / 1000 }))
} else {
 assert(log.includes('ResearchAgent ready:'))
 const question = DEMO_QUESTIONS.find(q => q.id === 'UC3')!.text
 const scope = await request('/api/scope', { question })
 const { runId } = await request('/runs', { question, budgetMinor: 200, plan: scope.plan })
 let snapshot
 for (;;) {
  snapshot = await request(`/runs/${runId}`)
  if (snapshot.phase === 'DONE') break
  if (snapshot.phase === 'FAILED' || Date.now() - started > 270000) throw Error('UC3 did not finish')
  await new Promise(r => setTimeout(r, 500))
 }
 const hash = snapshot.intents.find((i: { escrow?: { createHash?: string } }) => i.escrow?.createHash)?.escrow.createHash
 assert.match(hash || '', /^[A-F0-9]{64}$/)
 const r = await fetch('https://s.altnet.rippletest.net:51234/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'tx', params: [{ transaction: hash }] }) })
 const { result } = await r.json(); assert(result.validated); assert.equal(result.meta.TransactionResult, 'tesSUCCESS')
 writeFileSync('scratch/codespace-testnet/result.json', JSON.stringify({ label: 'Testnet · no real value · fixture models', seconds: (Date.now() - started) / 1000, hash }))
}
