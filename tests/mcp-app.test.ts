import { afterEach, expect, test, vi } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { request } from 'node:http'
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { APP_DAILY_CAP_MINOR, localOrigin, parseAppArgs, runApp, settingsHeaders } from '../mcp/app.js'
vi.mock('../mcp/testnet.js', () => ({ prepareMcpTestnet: vi.fn(), testnetStateDir: () => `${process.env.XDG_STATE_HOME}/researchagent/testnet` }))
import { prepareMcpTestnet } from '../mcp/testnet.js'
import { BUDGET } from '../shared/contracts/run.js'

const children: ChildProcess[] = []
const scratch: string[] = []
afterEach(() => { process.exitCode = undefined; vi.restoreAllMocks(); delete process.env.RA_BACKEND_URL; for (const child of children.splice(0)) child.kill('SIGKILL'); for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true }) })

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

// In-process, so the proxy, the static server and the ready block are covered without a browser or network.
const boot = async (args: string[], env: Record<string, string> = {}) => {
  const state = mkdtempSync(join(tmpdir(), 'ra-app-proc-')); scratch.push(state)
  const ui = join(state, 'ui'); (await import('node:fs')).mkdirSync(ui)
  writeFileSync(join(ui, 'index.html'), '<div id="root"></div>'); writeFileSync(join(ui, 'app.js'), 'export {}'); writeFileSync(join(ui, 'blob.bin'), 'x')
  const saved = { ...process.env }
  Object.assign(process.env, { XDG_STATE_HOME: state, ...env })
  const lines: string[] = []
  vi.spyOn(console, 'log').mockImplementation((line: string) => { lines.push(String(line)) })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const stop = new AbortController()
  const done = runApp(args, { ui, stop: stop.signal })
  const deadline = Date.now() + 30_000
  while (!lines.join('\n').includes('ResearchAgent ready') && Date.now() < deadline && !process.exitCode) await new Promise(r => setTimeout(r, 25))
  const out = lines.join('\n')
  return { out, url: out.match(/ready: (http:\/\/127\.0\.0\.1:\d+)/)?.[1] ?? '', tokenFile: out.match(/readFileSync\('([^']+)'/)?.[1] ?? '', done, stop, restore: () => { process.env = saved } }
}
const raw = (url: string, init: { method?: string; host?: string; body?: Buffer } = {}) => new Promise<number>((done, fail) => {
  const target = new URL(url)
  const req = request({ host: target.hostname, port: target.port, path: target.pathname, method: init.method ?? 'GET', headers: { ...(init.host ? { Host: init.host } : {}), ...(init.body ? { 'Content-Type': 'application/json' } : {}) } }, res => { res.resume(); res.on('end', () => done(res.statusCode ?? 0)) })
  req.on('error', fail); req.end(init.body)
})

test('simulated app in-process: static rules, proxy, idempotent web ask, oversize body, clean shutdown', async () => {
  const app = await boot(['--port', '0'])
  try {
    expect(app.out).toContain('· fixture models · SIMULATED rail · no real value'); expect(app.out).toContain('wallet daily cap S$20.00'); expect(app.out).not.toContain('payer address')
    expect(await raw(app.url + '/')).toBe(200); expect(await raw(app.url + '/app.js', { method: 'HEAD' })).toBe(200)
    expect(await raw(app.url + '/missing.js')).toBe(404); expect(await raw(app.url + '/blob.bin')).toBe(403); expect(await raw(app.url + '/', { method: 'POST' })).toBe(405)
    expect(await raw(app.url + '/', { host: 'evil.example' })).toBe(403)
    expect(await raw(app.url + '/api/health', { method: 'HEAD' })).toBe(200)
    expect(await raw(app.url + '/w/notfinancialtimes/')).toBe(200)
    expect(await raw(app.url + '/api/scope', { method: 'POST', body: Buffer.alloc(2 << 20, 97) })).toBe(502)
    const ask = () => fetch(app.url + '/runs', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'in-process' }, body: JSON.stringify({ question: 'What is the analyst outlook on the Kestrel Semiconductor deal with TSMC (pricing & margins)?', budgetMinor: 200 }) })
    const first = await ask(); expect(first.status).toBe(201)
    const { runId } = await first.json() as { runId: string }
    const again = await ask(); expect(again.status).toBe(200); expect(((await again.json()) as { runId: string }).runId).toBe(runId)
    for (let i = 0; i < 400; i++) { const run = await (await fetch(`${app.url}/runs/${runId}`)).json() as { phase: string }; if (['DONE', 'FAILED', 'STOPPED'].includes(run.phase)) break; await new Promise(r => setTimeout(r, 50)) }
    expect(existsSync(app.tokenFile)).toBe(true)
  } finally { app.stop.abort(); await app.done; app.restore() }
  expect(existsSync(app.tokenFile)).toBe(false)
}, 60_000)

test('Testnet label, daily cap and payer line come from the provisioned setup; a faucet failure is labelled SIMULATED with its reason', async () => {
  vi.mocked(prepareMcpTestnet).mockResolvedValue({ testnet: true, env: {}, labels: ['Testnet · no real value'] } as never)
  const live = await boot(['--testnet'])
  try { expect(live.out).toContain('· fixture models · XRPL TESTNET · no real value'); expect(live.out).toContain('payer address: '); expect(live.out).toContain('wallet daily cap S$5.00 (app Testnet default') } finally { live.stop.abort(); await live.done; live.restore() }
  const set = await boot(['--testnet'], { WALLET_DAILY_CAP_MINOR: '300' })
  try { expect(set.out).toContain('wallet daily cap S$3.00'); expect(set.out).not.toContain('app Testnet default') } finally { set.stop.abort(); await set.done; set.restore() }
  vi.mocked(prepareMcpTestnet).mockResolvedValue({ testnet: false, env: {}, labels: ['SIMULATED fallback · faucet_unavailable · no ledger transactions'] } as never)
  const down = await boot(['--testnet'])
  try { expect(down.out).toContain('fixture models · SIMULATED fallback · faucet_unavailable · no ledger transactions · no real value'); expect(down.out).toContain('settlement is SIMULATED: no ledger transactions') } finally { down.stop.abort(); await down.done; down.restore() }
}, 90_000)

test('refuses bad arguments and a remote backend before starting anything', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await runApp(['--bogus']); expect(process.exitCode).toBe(2)
  process.exitCode = undefined; process.env.RA_BACKEND_URL = 'http://127.0.0.1:1'
  await runApp([]); expect(process.exitCode).toBe(1)
})

test('app accepts IOU opt-in alongside Testnet without changing ports or spending caps', () => {
 expect(parseAppArgs(['--testnet', '--iou'])).toEqual({testnet:true,open:false,port:0})
 expect(APP_DAILY_CAP_MINOR).toBe(500)
})
test('IOU app ready block denominates prompt and daily caps in the labelled stand-in', async () => {
 vi.mocked(prepareMcpTestnet).mockResolvedValue({testnet:true,env:{ESCROW_ASSET:'test-iou'},labels:['Testnet · no real value']} as never)
 const app = await boot(['--testnet','--iou'])
 try {
  expect(prepareMcpTestnet).toHaveBeenLastCalledWith(undefined,'test-iou')
  expect(app.out).toContain('wallet daily cap TEST-SGD 5.00 · stand-in for RLUSD · no real value')
 } finally {app.stop.abort(); await app.done; app.restore()}
},30000)


test('Settings metadata is allowlisted and never forwarded to other routes', () => {
  const headers = { origin: 'http://127.0.0.1:1234', 'sec-fetch-site': 'same-origin', 'x-settings-ui': 'http://127.0.0.1:1234', 'x-settings-csrf': 'csrf', authorization: 'Bearer agent', cookie: 'private' }
  expect(settingsHeaders('/api/settings/key', headers)).toEqual(Object.fromEntries(Object.entries(headers).slice(0, 4)))
  for (const path of ['/runs', '/api/mcp/status', '/w/example']) expect(settingsHeaders(path, headers)).toEqual({})
  expect(settingsHeaders('/api/settings', { 'x-settings-ui': ['ambiguous', 'origin'] })).toEqual({})
})

test('zero-clone proxy supports audited owner Settings while cross-origin and agent requests cannot change caps, keys or network', async () => {
  const app = await boot(['--port', '0'], { DEEPSEEK_API_KEY: 'synthetic-settings-canary' })
  try {
    const headers = { 'X-Settings-UI': app.url, Origin: app.url, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' }
    const response = await fetch(app.url + '/api/settings', { headers })
    expect(response.status).toBe(200)
    const text = await response.text(); expect(text).not.toContain('synthetic-settings-canary')
    const state = JSON.parse(text)
    expect(state.keys.DEEPSEEK_API_KEY).toBe('••••••••')
    const owner = { ...headers, 'X-Settings-CSRF': state.csrf }
    const next = { ...state.values, MCP_MAX_BUDGET_MINOR: 123 }
    expect((await fetch(app.url + '/api/settings', { method: 'POST', headers: owner, body: JSON.stringify(next) })).status).toBe(200)
    for (const denied of [{}, { Authorization: 'Bearer mcp-or-llm' }, { ...owner, Origin: 'https://attacker.invalid' }, { ...owner, 'Sec-Fetch-Site': 'cross-site' }, headers] as Record<string, string>[]) {
      for (const [path, body] of [['', { ...next, MCP_MAX_BUDGET_MINOR: 500 }], ['', { ...next, SETTLEMENT_RAIL: 'xrpl-testnet' }], ['/key', { account: 'OPENAI_API_KEY', value: 'synthetic-attack' }]] as const) {
        expect((await fetch(app.url + '/api/settings' + path, { method: 'POST', headers: denied, body: JSON.stringify(body) })).status).toBe(403)
      }
    }
    const saved = await (await fetch(app.url + '/api/settings', { headers })).json()
    expect(saved.values).toEqual(next)
    const exported = await (await fetch(app.url + '/api/settings/export', { headers })).json()
    const saves = exported.audit.filter((e: { data: { action: string } }) => e.data.action === 'settings-save')
    expect(saves).toHaveLength(1)
    expect(saves[0]).toMatchObject({ principal: 'human', data: { after: next, applies: 'restart' } })
  } finally { app.stop.abort(); await app.done; app.restore() }
}, 60_000)
