import { register } from 'tsx/esm/api'
register()
const { ResourceScope } = await import('../shared/resource-scope.ts')
const scope = new ResourceScope()
// A real Claude Code client drives fixture providers and simulated settlement; no provider keys needed by the engine.
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))
if (spawnSync('claude', ['--version'], { stdio: 'ignore' }).status !== 0) {
  console.log('Claude Code is unavailable. Install it, authenticate, then run node scripts/mcp-demo.mjs. See README: Use it from Claude Code / Codex.')
  process.exit(0)
}
try {
const dir = scope.tempDir('ra-claude-mcp-')
const config = join(dir, 'mcp.json')
writeFileSync(config, JSON.stringify({ mcpServers: { researchagent: { command: process.execPath, args: ['--import', resolve(root, 'node_modules/tsx/dist/loader.mjs'), resolve(root, 'mcp/server.ts')], env: { RA_DATA_DIR: join(dir, 'data'), RA_LIVE: '0', RA_BACKEND_URL: '', MCP_MAX_BUDGET_MINOR: '200', MCP_DAILY_CAP_MINOR: '200' } } } }))
// An empty URL is not a configured backend; the server boots the local fixture engine.
const bible = JSON.parse(readFileSync(resolve(root, 'data/corpus/v2/story-bible.json'), 'utf8'))
const question = bible.useCases.find(u => u.id === 'UC2').question.replace(/\?$/, ' (pricing & margins)?')
const prompt = `Use only the researchagent MCP tools. First wallet_status, then search_expertise for this question, then ask_expert with budget_sgd=2 and idempotency_key="claude-uc2". Repeat ask_expert with that same key to prove the run id and charge are unchanged. Question: ${question} Give the answer with citation URLs, verified purchase amounts, run id, cap and settlement/provider labels. Explicitly state this is fictional fixture evidence and SIMULATED settlement, not a Testnet payment. Do not use shell, files, web or any other tools.`
const args = ['-p', prompt, '--model', 'sonnet', '--mcp-config', config, '--strict-mcp-config', '--setting-sources', '', '--tools', '', '--allowedTools', 'mcp__researchagent__wallet_status,mcp__researchagent__search_expertise,mcp__researchagent__ask_expert,mcp__researchagent__get_run', '--permission-mode', 'dontAsk', '--no-session-persistence', '--disable-slash-commands', '--output-format', 'stream-json', '--verbose']
const began = Date.now()
const child = scope.spawn('claude', args, { cwd: dir, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
let stdout = ''
child.stdout.on('data', data => { stdout += data })
// Do not persist stderr: local client startup diagnostics can include private machine/account details.
child.stderr.on('data', () => {})
const timeout = scope.timer(setTimeout(() => { void scope.close().catch(() => { process.exitCode = 1 }) }, 180_000))
const code = await new Promise((done, fail) => { child.once('error', fail); child.once('close', done) })
  clearTimeout(timeout)
  const events = stdout.split('\n').flatMap(line => { try { return [JSON.parse(line)] } catch { return [] } })
  const calls = events.flatMap(e => e.message?.content ?? []).filter(c => c.type === 'tool_use').map(c => ({ id: c.id, name: c.name, input: c.input }))
  const replies = events.flatMap(e => e.message?.content ?? []).filter(c => c.type === 'tool_result').flatMap(c => {
    try { const content = typeof c.content === 'string' ? c.content : c.content.find(x => x.type === 'text')?.text; return [{ id: c.tool_use_id, value: JSON.parse(content) }] } catch { return [] }
  })
  const asks = calls.filter(c => c.name.endsWith('__ask_expert')).map(c => replies.find(r => r.id === c.id)?.value).filter(Boolean)
  const pass = code === 0 && calls.some(c => c.name.endsWith('__search_expertise')) && asks.length >= 2 && asks[0].purchases?.some(p => p.verified) && asks[0].citations?.some(c => c.grantIntentId) && asks[0].run_id === asks[1].run_id && asks[0].spentMinor === asks[1].spentMinor
  const summary = { result: pass ? 'PASS' : 'INCOMPLETE', elapsedSeconds: Math.round((Date.now() - began) / 100) / 10, mode: 'fixture providers; SIMULATED settlement; fictional writers; no XRPL transaction', tools: calls.map(c => ({ name: c.name, input: c.input })), runs: asks.map(a => ({ run_id: a.run_id, phase: a.phase, budgetMinor: a.budgetMinor, spentMinor: a.spentMinor, labels: a.labels, purchases: a.purchases, citations: a.citations })) }
  const date = new Date().toISOString().slice(0, 10)
  const outputDir = resolve(root, 'eval/mcp')
  mkdirSync(outputDir, { recursive: true })
  // Only tool evidence is retained; full client output may contain private session/account metadata.
  writeFileSync(join(outputDir, `transcript-${date}.md`), `# Claude Code → ResearchAgent MCP fixture transcript summary\n\nFresh, non-persistent Claude Code print session, only four ResearchAgent MCP tools enabled. Engine providers and payments are fixtures; the calling Claude model is real. No Testnet transaction was attempted.\n\nUC2's recorded pricing-and-margins clarification is included in the question because MCP skips interactive clarification.\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n`)
  console.log(`Claude Code MCP fixture demo: ${summary.result}; ${summary.elapsedSeconds}s. Summary: eval/mcp/transcript-${date}.md`)
  if (!pass) process.exitCode = 1

} finally { await scope.close() }
