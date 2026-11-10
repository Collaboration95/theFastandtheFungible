// Where the browser scenes get their product: the hosted judge demo, or a local HOSTED=1 stack as the fallback.
// The local stack is the same one the hosted UI tests use (tests/helpers/hosted-stack.ts): fixture models, the
// simulated rail, a throwaway HTTPS origin, ephemeral ports. It never touches 5100, 8788 or 8790.
import { spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { request } from 'node:https'
import { join } from 'node:path'
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

function livez(port) {
  return new Promise(done => {
    const req = request({ host: 'localhost', port, path: '/livez', rejectUnauthorized: false, timeout: 2000 }, res => { res.resume(); done(res.statusCode === 200) })
    req.on('error', () => done(false)); req.on('timeout', () => { req.destroy(); done(false) }); req.end()
  })
}

/** Start the local HOSTED=1 stack. Returns { url, stackDir, close() }. Builds the web app first if dist/ is missing. */
export async function startLocalStack() {
  if (!existsSync(join(ROOT, 'dist/index.html'))) await must('npm', ['run', 'build'], { cwd: ROOT })
  const ports = await allocateDemoPorts()
  const stackDir = scratchDir('stack-')
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, LANG: process.env.LANG ?? 'en_US.UTF-8',
    HOSTED_WEB_PORT: String(ports.web), HOSTED_API_PORT: String(ports.api), HOSTED_PUBLISHER_PORT: String(ports.pub),
    HOSTED_STACK_DIR: stackDir, DOTENV_CONFIG_PATH: '.video-no-env',
  }
  const child = spawn(process.execPath, ['--import', 'tsx', 'tests/helpers/hosted-stack.ts'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', d => { stderr += d })
  for (let i = 0; i < 300; i++) {
    if (child.exitCode !== null) throw new Error(`local stack exited early:\n${stderr.slice(-800)}`)
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
