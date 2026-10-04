import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import dotenv from 'dotenv'
dotenv.config({ quiet: true })
const live = process.argv.includes('--live')
const env = { ...process.env, HOST: '127.0.0.1', PORT: '8788', PUBLISHER_PORT: '8790', PUBLISHER_URL: process.env.PUBLISHER_URL || 'http://127.0.0.1:8790', PUBLISHER_SECRET: process.env.PUBLISHER_SECRET || 'local-simulated-demo-secret', LLM_PROVIDER: live ? 'groq' : 'fixture', DECISION_PROVIDER: live ? 'cloudflare' : 'fixture' }
const children = []
let stopping = false
function shutdown(code = 0) { if (stopping) return; stopping = true; children.forEach(c => c.kill('SIGTERM')); setTimeout(() => { children.forEach(c => c.kill('SIGKILL')); process.exit(code) }, 1500).unref() }
function start(command, args) { const child = spawn(command, args, { env, stdio: 'inherit', cwd: process.cwd() }); children.push(child); child.on('error', () => shutdown(1)); child.on('exit', code => { if (!stopping) { console.error('A demo process stopped. Check the visible error and available ports.'); shutdown(code || 1) } }); return child }
async function health(url) { for (let i=0;i<100;i++) { if (stopping) throw new Error('Demo stopped'); try { const r=await fetch(url,{signal:AbortSignal.timeout(500)}); if(r.ok)return } catch { /* child becoming ready */ } await new Promise(r=>setTimeout(r,200)) } throw new Error(`Service did not become ready: ${url}`) }
process.on('SIGINT',()=>shutdown());process.on('SIGTERM',()=>shutdown())
try {
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1):8790\/?$/.test(env.PUBLISHER_URL)) start(process.execPath, ['--import','tsx','publisher/server.ts'])
  await health(`${env.PUBLISHER_URL.replace(/\/$/,'')}/health`)
  start(process.execPath,['--import','tsx','server/index.ts'])
  await health('http://127.0.0.1:8788/health')
  start(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5100','--strictPort'])
  await health('http://127.0.0.1:5100')
  console.log(`ResearchAgent ready: http://127.0.0.1:5100 · ${live?'live providers (visible fixtures on failure)':'fixture'} · x402-shaped · SIMULATED SGD · no real funds`)
} catch(error) { console.error(error.message); shutdown(1) }
