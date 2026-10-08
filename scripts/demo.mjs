import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'
import dotenv from 'dotenv'
import { applyBackupPair } from './stage-checks.mjs'
dotenv.config({ quiet: true })
const live = process.argv.includes('--live')
// CF_BACKUP=1 (#196): every Cloudflare client in this demo uses the backup pair (_2) instead. Names only, never values.
if (process.env.CF_BACKUP === '1') {
  try { console.log(`CF_BACKUP=1: using the backup Cloudflare pair for ${applyBackupPair(process.env).join(', ')}`) } catch (error) { console.error(error.message); process.exit(1) }
}
// DEMO_PORT_OFFSET shifts all three ports so a worktree can run beside main (100 → 5200/8888/8890).
const offset = Number(process.env.DEMO_PORT_OFFSET || 0)
const ports = { web: 5100 + offset, api: 8788 + offset, pub: 8790 + offset }
const localPublisher = `http://127.0.0.1:${ports.pub}`
const publisherUrl = !process.env.PUBLISHER_URL || /^https?:\/\/(?:localhost|127\.0\.0\.1):8790\/?$/.test(process.env.PUBLISHER_URL) ? localPublisher : process.env.PUBLISHER_URL
const env = { ...process.env, HOST: '127.0.0.1', PORT: String(ports.api), PUBLISHER_PORT: String(ports.pub), PUBLISHER_URL: publisherUrl, PUBLISHER_SECRET: process.env.PUBLISHER_SECRET || 'local-simulated-demo-secret', LLM_PROVIDER: live ? 'deepseek' : 'fixture', // live forces DeepSeek even when .env says groq
  // Live search embeds queries with Workers AI (hybrid); fixtures and tests stay keyword-only.
  SEARCH_EMBEDDINGS: live ? 'live' : (process.env.SEARCH_EMBEDDINGS || 'off'), DECISION_PROVIDER: live ? 'cloudflare' : 'fixture',
  // Live pays on the XRPL Testnet when a payer seed exists; SETTLEMENT_RAIL overrides (e.g. XRPL with fixture LLMs).
  SETTLEMENT_RAIL: process.env.SETTLEMENT_RAIL || (live && process.env.XRPL_PAYER_SEED ? 'xrpl-testnet' : 'simulated'),
  // Langfuse Cloud traces for live runs only (fixture demos and browser tests stay local).
  LANGFUSE_ENABLED: process.env.LANGFUSE_ENABLED || (live ? '1' : '0'), LANGFUSE_TRACING_ENVIRONMENT: process.env.LANGFUSE_TRACING_ENVIRONMENT || (live ? 'live' : 'fixture') }
const children = []
let stopping = false
function shutdown(code = 0) { if (stopping) return; stopping = true; children.forEach(c => c.kill('SIGTERM')); setTimeout(() => { children.forEach(c => c.kill('SIGKILL')); process.exit(code) }, 1500).unref() }
function start(command, args) { const child = spawn(command, args, { env, stdio: 'inherit', cwd: process.cwd() }); children.push(child); child.on('error', () => shutdown(1)); child.on('exit', code => { if (!stopping) { console.error('A demo process stopped. Check the visible error and available ports.'); shutdown(code || 1) } }); return child }
async function health(url) { for (let i=0;i<100;i++) { if (stopping) throw new Error('Demo stopped'); try { const r=await fetch(url,{signal:AbortSignal.timeout(500)}); if(r.ok)return } catch { /* child becoming ready */ } await new Promise(r=>setTimeout(r,200)) } throw new Error(`Service did not become ready: ${url}`) }
process.on('SIGINT',()=>shutdown());process.on('SIGTERM',()=>shutdown())
try {
  // Live preflight is advisory (it only warns), so run it beside the startup instead of in front of it.
  if (live) once(spawn(process.execPath, ['--import', 'tsx', 'scripts/doctor.mjs', '--keys'], { env, stdio: 'inherit' }), 'exit').then(([code]) => { if (code) console.warn('\n⚠ Provider preflight failed. Starting anyway; failed answer calls show as labelled fixtures and failed decision rounds buy nothing.\n') })
  if (publisherUrl === localPublisher) start(process.execPath, ['--import','tsx','publisher/server.ts'])
  start(process.execPath,['--import','tsx','server/index.ts'])
  start(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(ports.web),'--strictPort'])
  await Promise.all([health(`${env.PUBLISHER_URL.replace(/\/$/,'')}/health`), health(`http://127.0.0.1:${ports.api}/health`), health(`http://127.0.0.1:${ports.web}`)])
  console.log(`Writers' web (/w/ index): ${env.PUBLISHER_URL.replace(/\/$/,'')}/w/`)
  console.log(`ResearchAgent ready: http://127.0.0.1:${ports.web} · ${live?'live providers (a failed decision round buys nothing)':'fixture'} · ${env.SETTLEMENT_RAIL === 'xrpl-testnet' ? 'XRPL TESTNET · no real value' : 'SIMULATED SGD · no real funds'}`)
} catch(error) { console.error(error.message); shutdown(1) }
