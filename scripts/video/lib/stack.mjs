// Where the browser scenes get their product: the hosted judge demo, or a local HOSTED=1 stack as the fallback.
// The local stack is the same one the hosted UI tests use (tests/helpers/hosted-stack.ts): fixture models, the
// simulated rail, a throwaway HTTPS origin, ephemeral ports. It never touches 5100, 8788 or 8790.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { request } from 'node:https'
import { homedir } from 'node:os'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { ROOT, HOSTED_URL, scratchDir, sleep } from '../config.mjs'
import { allocateDemoPorts } from '../../demo-ports.mjs'
import { must } from './proc.mjs'

/** GET /api/demo/status of the hosted demo; never throws. */
export async function probeHosted(url = HOSTED_URL) {
  try {
    const response = await fetch(`${url}/api/demo/status`, { signal: AbortSignal.timeout(15000) })
    const body = await response.json().catch(() => ({}))
    return { reachable: response.ok, httpStatus: response.status, state: body.state ?? 'unknown', labels: body.labels ?? {}, remaining: body.remaining ?? {} }
  } catch (error) { return { reachable: false, httpStatus: 0, state: 'unreachable', labels: {}, remaining: {}, error: String(error.message ?? error) } }
}

function privateWriterKey(key) {
  const file = join(homedir(), '.config/researchagent-hosted/wallets', key)
  if ((statSync(file).mode & 0o777) !== 0o600) throw new Error('Writer key file must be mode 0600')
  return readFileSync(file, 'utf8').trim()
}

function livez(port) {
  return new Promise(done => {
    const req = request({ host: 'localhost', port, path: '/livez', rejectUnauthorized: false, timeout: 2000 }, res => { res.resume(); done(res.statusCode === 200) })
    req.on('error', () => done(false)); req.on('timeout', () => { req.destroy(); done(false) }); req.end()
  })
}

/** Start the local HOSTED=1 stack. Returns { url, stackDir, close() }. Builds the web app first if dist/ is missing. */
export async function startLocalStack() {
  await must('npm', ['run', 'build'], { cwd: ROOT })
  const ports = await allocateDemoPorts()
  const stackDir = scratchDir('stack-')
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, LANG: process.env.LANG ?? 'en_US.UTF-8',
    HOSTED_WEB_PORT: String(ports.web), HOSTED_API_PORT: String(ports.api), HOSTED_PUBLISHER_PORT: String(ports.pub),
    HOSTED_STACK_DIR: stackDir, DOTENV_CONFIG_PATH: '.video-no-env',
  }
  // Reuse X2's local harness: real writer identity, fixture models, simulated buyer. No setup transactions.
  const { Wallet } = await import('xrpl')
  env.WRITER_CREDENTIAL_DOMAIN = 'D0B5DB2A87E03E375B3CF519B2323971C9E4D0300D31F93F8EAA927F0680B998'
  for (const file of readdirSync(join(ROOT, 'data/writers')).filter(f => f.endsWith('.json'))) {
    const slug = JSON.parse(readFileSync(join(ROOT, 'data/writers', file), 'utf8')).publisher.slug
    const key = `XRPL_PUBLISHER_${slug.toUpperCase().replaceAll('-', '_')}_SEED`
    env[key] = ['team-builder-notes', 'team-xrpl-explainers', 'open-records'].includes(slug)
      ? privateWriterKey(key) : Wallet.generate().seed
  }
  const child = spawn(process.execPath, ['--import', 'tsx', 'docs/evidence/writer-credentials-nov12/local-hosted.ts'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'pipe'] })
  child.stderr.on('data', () => {})
  for (let i = 0; i < 300; i++) {
    if (child.exitCode !== null) throw new Error('local identity stack exited early; no private child diagnostics are printed')
    if (await livez(ports.web)) break
    await sleep(300)
  }
  if (!(await livez(ports.web))) { child.kill('SIGTERM'); throw new Error('local stack never became live') }
  return {
    url: `https://localhost:${ports.web}`, stackDir,
    async close() {
      child.kill('SIGTERM')
      await new Promise(done => { child.on('close', done); setTimeout(done, 6000) })
      rmSync(stackDir, { recursive: true, force: true })
    },
  }
}

/** Serve the current built replay locally, with its real recorded Testnet transactions. */
export async function startReplay() {
  await must('npm', ['run', 'build:demo'], { cwd: ROOT })
  const root = join(ROOT, 'site/demo'), prefix = '/theFastandtheFungible/demo/'
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' }
  const server = createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    const file = resolve(root, pathname.startsWith(prefix) ? pathname.slice(prefix.length) || 'index.html' : 'index.html')
    if (!file.startsWith(root + sep) || !existsSync(file)) { res.writeHead(404); res.end(); return }
    res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream'); res.end(readFileSync(file))
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  return { url: `http://127.0.0.1:${server.address().port}${prefix}`, close: () => new Promise(done => server.close(done)) }
}
