import { afterEach, expect, test } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { APP_DAILY_CAP_MINOR, localOrigin, parseAppArgs } from '../mcp/app.js'
import { BUDGET } from '../shared/contracts/run.js'

const children: ChildProcess[] = []
const scratch: string[] = []
afterEach(() => { for (const child of children.splice(0)) child.kill('SIGKILL'); for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true }) })

test('arguments are strict, the port is ephemeral by default, and nothing opens a browser unasked', () => {
  expect(parseAppArgs([])).toEqual({ testnet: false, open: false, port: 0 })
  expect(parseAppArgs(['--testnet', '--port', '7001', '--open'])).toEqual({ testnet: true, open: true, port: 7001 })
  for (const bad of [['--port'], ['--port', 'x'], ['--port', '70000'], ['--live'], ['--http']]) expect(() => parseAppArgs(bad)).toThrow(/Usage/)
})

test('the app Testnet daily cap is conservative: below the wallet default and no more than one maximum prompt budget', () => {
  expect(APP_DAILY_CAP_MINOR).toBeLessThan(2000)
  expect(APP_DAILY_CAP_MINOR).toBeLessThanOrEqual(BUDGET.maxMinor)
})

test('only the printed loopback origin may reach the engine proxy (DNS rebinding and cross-origin posts)', () => {
  expect(localOrigin({ host: '127.0.0.1:7001' }, 7001)).toBe(true)
  expect(localOrigin({ host: 'localhost:7001', origin: 'http://localhost:7001' }, 7001)).toBe(true)
  expect(localOrigin({ host: 'evil.example:7001' }, 7001)).toBe(false)
  expect(localOrigin({ host: '127.0.0.1:7002' }, 7001)).toBe(false)
  expect(localOrigin({ host: '127.0.0.1:7001', origin: 'http://evil.example' }, 7001)).toBe(false)
  expect(localOrigin({ host: '127.0.0.1:7001', origin: 'null' }, 7001)).toBe(false)
})

const built = existsSync('dist/index.html')
test.skipIf(!built)('simulated app boots on an ephemeral port, serves the UI, proxies with the bearer, and removes its token file on exit', async () => {
  const state = mkdtempSync(join(tmpdir(), 'ra-app-test-')); scratch.push(state)
  const child = spawn(process.execPath, ['--import', 'tsx', 'mcp/server.ts', 'app', '--port', '0'], { env: { PATH: process.env.PATH, HOME: state, XDG_STATE_HOME: state }, stdio: 'pipe' })
  children.push(child)
  let out = ''
  child.stdout.on('data', chunk => { out += chunk })
  child.stderr.resume()
  const url = await new Promise<string>((done, fail) => {
    const timer = setTimeout(() => fail(Error('app did not become ready')), 30_000)
    const poll = setInterval(() => { const m = out.match(/ResearchAgent ready: (http:\/\/127\.0\.0\.1:(\d+)) · fixture models · SIMULATED rail · no real value/); if (m) { clearTimeout(timer); clearInterval(poll); done(m[1]) } }, 50)
    child.once('exit', code => { clearTimeout(timer); clearInterval(poll); fail(Error(`app exited (${code})`)) })
  })
  const port = Number(new URL(url).port)
  expect([5100, 8788, 8790]).not.toContain(port)
  expect(out).not.toMatch(/seed|secret/i)
  expect(await (await fetch(url)).text()).toContain('<div id="root"')
  const health = await fetch(`${url}/api/health`)
  expect(health.status).toBe(200) // engine bearer added by the proxy, never in the browser
  expect((await fetch(`${url}/data/corpus/v2/x.json`)).status).toBe(403)
  expect((await fetch(`${url}/api/scope`, { method: 'POST', headers: { Origin: 'http://evil.example', 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(403)
  const tokenFile = out.match(/readFileSync\('([^']+)'/)![1]
  expect(statSync(tokenFile).mode & 0o777).toBe(0o600)
  expect(out).not.toContain((await import('node:fs')).readFileSync(tokenFile, 'utf8').trim())
  child.kill('SIGTERM')
  await new Promise(done => child.once('exit', done))
  expect(existsSync(tokenFile)).toBe(false)
}, 60_000)
