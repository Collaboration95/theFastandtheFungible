// Preflight for the demo. Run: node --import tsx scripts/doctor.mjs [--keys] [--deep]
//   --keys  only the provider checks (used by demo:live before it starts)
//   --deep  also spend one tiny Groq completion and one Clef call to prove the models answer
// Never prints keys or provider response bodies. Exits 1 if any check fails.
import 'dotenv/config'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { ClefDecisionProvider } from '../server/agents/clef.ts'

const args = new Set(process.argv.slice(2))
const keysOnly = args.has('--keys'), deep = args.has('--deep')
let failed = false
const ok = msg => console.log(`  ✓ ${msg}`)
const warn = msg => console.log(`  ⚠ ${msg}`)
const fail = msg => { failed = true; console.log(`  ✗ ${msg}`) }
const keyNames = text => new Set([...text.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=/gm)].map(m => m[1]))

if (!keysOnly) {
  console.log('Environment')
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major > 22 || (major === 22 && minor >= 13)) ok(`Node ${process.versions.node}`)
  else fail(`Node ${process.versions.node}; node:sqlite needs >= 22.13 (see .nvmrc)`)
  if (existsSync('node_modules/.package-lock.json')) ok('dependencies installed')
  else fail('dependencies missing; run npm ci')
  if (!existsSync('.env')) warn('.env missing; fixture demo still works. cp .env.example .env for live mode')
  else {
    const expected = keyNames(readFileSync('.env.example', 'utf8')), actual = keyNames(readFileSync('.env', 'utf8'))
    const stale = [...actual].filter(k => !expected.has(k))
    if (stale.length) warn(`.env has vars nothing reads (safe to delete): ${stale.join(', ')}`)
    if (!stale.length) ok('.env only uses known vars (unset ones take .env.example defaults)')
  }

  console.log('Ports')
  const offset = Number(process.env.DEMO_PORT_OFFSET || 0)
  for (const [name, port, path] of [['web', 5100 + offset, '/'], ['api', 8788 + offset, '/health'], ['publisher', 8790 + offset, '/health']]) {
    const free = await new Promise(resolve => { const s = createServer().once('error', () => resolve(false)).listen(port, '127.0.0.1', () => s.close(() => resolve(true))) })
    if (free) { ok(`${name} :${port} free`); continue }
    const ours = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(1000) }).then(r => r.ok, () => false)
    warn(`${name} :${port} in use${ours ? ' (looks like a running demo)' : ' by another process'}; make kill frees it, or set DEMO_PORT_OFFSET`)
  }
}

console.log('Groq (answer + report)')
const groqKey = process.env.GROQ_API_KEY
const model = process.env.LLM_MODEL || 'llama-3.3-70b-versatile'
if (!groqKey) fail('GROQ_API_KEY not set; demo:live answers will be labelled fixtures')
else {
  const base = (process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '')
  let groqOk = false
  const headers = { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' }
  try {
    const res = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(5000) })
    if (res.status === 401 || res.status === 403) fail(`key rejected (HTTP ${res.status})`)
    else if (!res.ok) fail(`models endpoint HTTP ${res.status}`)
    else {
      ok('key accepted')
      const ids = (await res.json()).data?.map(m => m.id) ?? []
      if (ids.includes(model)) { groqOk = true; ok(`model ${model} available`) }
      else fail(`model ${model} not offered to this key`)
    }
  } catch { fail('Groq unreachable (network or timeout)') }
  if (deep && groqOk) {
    try {
      const started = Date.now()
      const res = await fetch(`${base}/chat/completions`, { method: 'POST', headers, signal: AbortSignal.timeout(15000), body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: 'user', content: 'Reply OK.' }] }) })
      const h = name => res.headers.get(name) ?? '?'
      const limits = `requests left ${h('x-ratelimit-remaining-requests')}/${h('x-ratelimit-limit-requests')}, tokens left ${h('x-ratelimit-remaining-tokens')}/${h('x-ratelimit-limit-tokens')}`
      if (res.status === 429) fail(`rate limited now (retry-after ${h('retry-after')}s); ${limits}`)
      else if (!res.ok) fail(`completion HTTP ${res.status}`)
      else ok(`completion in ${Date.now() - started} ms; ${limits}`)
    } catch { fail('completion timed out') }
  }
}

console.log('Cloudflare Clef (decisions)')
if (!process.env.CLOUDFLARE_API_TOKEN) fail('CLOUDFLARE_API_TOKEN not set; demo:live decisions will be labelled fixtures')
else {
  // Reuse the app's own client so the check exercises the exact request format.
  const clef = new ClefDecisionProvider({ allowLive: true, timeoutMs: 8000 })
  try {
    await clef.resolveAccount()
    ok(process.env.CLOUDFLARE_ACCOUNT_ID ? 'token set; account id from .env (not verified without --deep)' : 'token accepted; account resolved')
  } catch (error) { fail(`token/account check failed (${error.status ?? 'error'})`) }
  if (deep) {
    try {
      const started = Date.now()
      const { gapMaterial } = await clef.judgeRound({ question: 'Will the project be operating by 2028?', conclusion: 'Demand is strong; grid timing is unknown.', gap: 'No evidence on grid energisation dates.' })
      ok(`${clef.model} answered in ${Date.now() - started} ms (gap_material ${gapMaterial.toFixed(2)})`)
    } catch (error) { fail(`${clef.model} call failed (${error.status ?? 'error'})`) }
  }
}

if (!deep) console.log('\n(add --deep to spend one Groq + one Clef call and check live rate limits)')
console.log(failed ? '\nDoctor: problems found.' : '\nDoctor: all good.')
process.exit(failed ? 1 : 0)
