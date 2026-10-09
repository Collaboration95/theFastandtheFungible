// Cloud Run entrypoint (scripts/cloudrun-deploy.sh): pick a Cloudflare pair, start the publisher and API on loopback,
// then nginx on 8080 once both answer /health. Any child exiting stops the container so Cloud Run replaces the instance.
import { spawn } from 'node:child_process'
import { probeWorkersAi } from '../../scripts/cf-probe.mjs'
import { pickCloudflarePair, withCloudflarePair } from './cloudflare.mjs'

const picked = await pickCloudflarePair(process.env, probeWorkersAi)
for (const line of picked.lines) console.log(`Workers AI probe · ${line}`)
console.log(picked.chosen ? `Cloudflare: using ${picked.chosen.name}` : 'Cloudflare: no pair answered; live search runs keyword only (labelled)')
const env = { ...withCloudflarePair(process.env, picked.chosen), HOST: '127.0.0.1', PUBLISHER_URL: 'http://127.0.0.1:8790', PUBLISHER_PORT: '8790' }

const children = []
let stopping = false
function stop(code) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  setTimeout(() => process.exit(code), 2000)
}
function start(name, command, args, extra = {}) {
  const child = spawn(command, args, { env: { ...env, ...extra }, stdio: 'inherit', cwd: '/app' })
  children.push(child)
  child.on('exit', code => { if (!stopping) { console.error(`${name} exited (${code}); stopping the container`); stop(1) } })
}
async function ready(url) {
  for (let i = 0; i < 300; i++) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return } catch { /* still starting */ }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`not ready: ${url}`)
}
process.on('SIGTERM', () => stop(0))
process.on('SIGINT', () => stop(0))

start('publisher', 'node', ['dist/publisher.mjs'], { PORT: '8790' })
start('api', 'node', ['dist/api.mjs'], { PORT: '8788' })
try {
  await Promise.all([ready('http://127.0.0.1:8790/health'), ready('http://127.0.0.1:8788/health')])
} catch (error) {
  console.error(error.message)
  stop(1)
}
if (!stopping) {
  start('nginx', 'nginx', ['-c', '/app/docker/cloudrun/nginx.conf', '-g', 'daemon off;'])
  console.log(`ResearchAgent on Cloud Run · ${env.LLM_PROVIDER} · decisions ${env.DECISION_PROVIDER} · ${env.SETTLEMENT_RAIL} · embeddings ${env.SEARCH_EMBEDDINGS}`)
}
