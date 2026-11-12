// T5 · stage kit: every tier decision with mocked fetch and WebSocket, the one-cookie-jar rule, "never a hosted question", and a
// replay server that binds only an ephemeral loopback port with outside requests blocked. No real network, no fixed port.
import { describe, expect, it } from 'vitest'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { join } from 'node:path'
import { resources } from './helpers/resource-scope.js'
import {
  CHECK_MS, DEFAULTS, FORBIDDEN_PORTS, KEY_TX, NODES, REPLAY_BASE, REPLAY_CSP, ROOT, TIERS, checkFiles, cookieJar, decideTier, githubFetch, main, parseArgs, renderReport, runChecks, serveReplay, timed,
  type CheckResult, type Deps,
} from '../scripts/stage-check.mjs'

const mp4Header = Buffer.from('000000186674797069736F6D0000020069736F6D6D703432', 'hex')
const scratch = () => resources().tempDir('stage-check-test-')

it('uses authenticated gh for GitHub release metadata and HEAD of the asset bytes', async () => {
  const calls: string[][] = []
  const run = async (command: string, args: string[]) => {
    expect(command).toBe('gh'); calls.push(args)
    return { stdout: args[0] === 'release' ? JSON.stringify({ assets: [{ name: 'researchagent-mcp-1.1.1.tgz', apiUrl: 'https://api.github.com/assets/123' }] }) : 'HTTP/2.0 302 Found\n\nHTTP/2.0 200 OK\n' }
  }
  expect(await githubFetch('https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.1/researchagent-mcp-1.1.1.tgz', { method: 'HEAD' }, run)).toEqual({ status: 200 })
  expect(calls).toEqual([
    ['release', 'view', 'v1.1.1', '--repo', 'Collaboration95/theFastandtheFungible', '--json', 'assets'],
    ['api', '--include', '--method', 'HEAD', '-H', 'Accept: application/octet-stream', 'https://api.github.com/assets/123'],
  ])
  expect(await githubFetch('https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.1/missing.tgz', { method: 'HEAD' }, run)).toEqual({ status: 404 })
})

// ---- mocks -------------------------------------------------------------------------------------------------------------

type World = {
  hosted?: { state?: string; status?: number; remaining?: { questions: number; minor: number }; wait?: { ahead: number } } | 'down' | 'hang' | 'not-json'
  explorer?: number | 'down'; pages?: number; release?: Record<string, number>
  node?: 'up' | 'down' | 'clio-only'; tx?: 'ok' | 'not-found' | 'wrong'
  verify?: { code: number; output: string }
}
const calls: { method: string; url: string; cookie?: string }[] = []
const sockets: string[] = []
const closed: string[] = []

function mocks(world: World = {}): Deps {
  const response = (status: number, body?: unknown, cookies: string[] = []) => ({ status, ok: status < 400, headers: { getSetCookie: () => cookies }, json: async () => { if (body === undefined) throw new Error('not json'); return body }, body: { cancel: async () => undefined } })
  const fetch: Deps['fetch'] = (url, init = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>
    calls.push({ method: String(init.method ?? 'GET'), url, cookie: headers.cookie })
    const signal = init.signal as AbortSignal | undefined
    if (url.includes('/api/demo/status')) {
      const h = world.hosted ?? { state: 'ready' }
      if (h === 'down') return Promise.reject(new Error('getaddrinfo ENOTFOUND'))
      if (h === 'hang') return new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted'))))
      if (h === 'not-json') return Promise.resolve(response(502))
      return Promise.resolve(response(h.status ?? 200, { state: h.state ?? 'ready', remaining: h.remaining ?? { questions: 5, minor: 1000 }, ...(h.wait ? { wait: h.wait } : {}) }, ['__Host-ra_session=abc123; Max-Age=86400; Path=/; HttpOnly; Secure']))
    }
    if (url.startsWith('https://testnet.xrpl.org/')) return world.explorer === 'down' ? Promise.reject(new Error('connect ETIMEDOUT')) : Promise.resolve(response(world.explorer ?? 200))
    if (url.startsWith('https://collaboration95.github.io/')) return Promise.resolve(response(world.pages ?? 200))
    if (url.includes('/releases/download/')) {
      const tag = /download\/(v[\d.]+)\//.exec(url)![1]
      return Promise.resolve(response(world.release?.[tag] ?? 200))
    }
    return Promise.reject(new Error(`unexpected request ${url}`))
  }
  class FakeSocket {
    listeners: Record<string, ((event: { data?: string }) => void)[]> = {}
    constructor(public url: string) {
      sockets.push(url)
      const usable = world.node === 'up' || world.node === undefined || (world.node === 'clio-only' && url.includes('clio'))
      setTimeout(() => this.emit(usable ? 'open' : 'error', {}), 0)
    }
    addEventListener(type: string, listener: (event: { data?: string }) => void) { (this.listeners[type] ??= []).push(listener) }
    emit(type: string, event: { data?: string }) { for (const listener of this.listeners[type] ?? []) listener(event) }
    send(raw: string) {
      const { id, command } = JSON.parse(raw)
      const reply = command === 'ledger_current'
        ? { id, status: 'success', result: { ledger_current_index: 22_236_000 } }
        : world.tx === 'not-found' ? { id, status: 'error', error: 'txnNotFound' }
        : world.tx === 'wrong' ? { id, status: 'success', result: { validated: false, TransactionType: 'Payment' } }
        : { id, status: 'success', result: { validated: true, ledger_index: 22_228_567, TransactionType: 'EscrowFinish', Fulfillment: 'A0228020' + 'AB'.repeat(32) } }
      setTimeout(() => this.emit('message', { data: JSON.stringify(reply) }), 0)
    }
    close() { closed.push(this.url) }
  }
  return {
    fetch, WebSocket: FakeSocket as unknown as Deps['WebSocket'],
    exists: file => { try { statSync(file); return true } catch { return false } },
    readFile: file => readFileSync(file),
    run: async () => world.verify ?? { code: 0, output: 'PASS audit anchor\nRESULT PASS\n' },
  }
}
const withReal = (deps: Deps): Deps => deps
const run = async (world: World = {}, options: Parameters<typeof runChecks>[0] = {}) => {
  const dir = scratch(), video = join(dir, 'demo.mp4')
  writeFileSync(video, mp4Header)
  const results = await runChecks({ video, jarFile: join(dir, 'jar.json'), ms: 500, ...options }, withReal(mocks(world)))
  return { results, decision: decideTier(results), by: (id: string) => results.find(row => row.id === id) as CheckResult }
}

// ---- tier decisions ----------------------------------------------------------------------------------------------------

describe('tier decisions (story §2.3)', () => {
  it('tier 1 when the sandbox is ready and the explorer and public node answer', async () => {
    const { decision, by, results } = await run()
    expect(decision.tier).toBe(1)
    expect(by('hosted')).toMatchObject({ status: 'GO', detail: 'ready · 5 of 5 questions left, S$10.00' })
    expect(by('node').detail).toContain('ledger 22236000')
    expect(by('key-tx').status).toBe('GO')
    expect(by('verify')).toMatchObject({ status: 'GO', detail: 'RESULT PASS' })
    expect(by('receipts').status).toBe('GO')
    expect(by('video').status).toBe('GO'); expect(by('deck').status).toBe('GO')
    expect(results.every(row => row.status === 'GO' || row.advisory)).toBe(true)
    expect(decision).toMatchObject({ name: 'Live', say: TIERS[1].say })
    expect(decision.fallbacks).toEqual([{ tier: 2, ready: true, missing: [] }, { tier: 3, ready: true, missing: [] }, { tier: 4, ready: true, missing: [] }])
  })
  it('stays tier 1 when the sandbox is busy, and says not to ask a new question', async () => {
    const { decision, by } = await run({ hosted: { state: 'busy', wait: { ahead: 2 } } })
    expect(decision.tier).toBe(1)
    expect(by('hosted').detail).toContain('do not ask a new question')
    expect(decision.notes.join(' ')).toMatch(/busy with another visitor/)
  })
  it.each(['paused', 'ended', 'degraded'])('tier 2 when the sandbox is %s, with the explorer and node up', async state => {
    const { decision, by } = await run({ hosted: { state } })
    expect(by('hosted').status).toBe('NO-GO'); expect(by('hosted').detail).toContain(state)
    expect(decision.tier).toBe(2); expect(decision.say).toBe(TIERS[2].say)
  })
  it('reads a paused sandbox’s 503 status body (the paused shell answers 503 with the same body)', async () => {
    const { decision, by } = await run({ hosted: { state: 'paused', status: 503 } })
    expect(by('hosted').detail).toMatch(/^paused/); expect(decision.tier).toBe(2)
  })
  it.each([['down', 'unreachable'], ['not-json', 'not a status body'], ['hang', 'no answer in']] as const)('tier 2 with a note when the sandbox page itself does not answer (%s)', async (hosted, text) => {
    const { decision, by } = await run({ hosted })
    expect(by('hosted').status).toBe('NO-GO'); expect(by('hosted').detail).toContain(text)
    expect(decision.tier).toBe(2)
    expect(decision.notes.join(' ')).toMatch(/not answering at all/)
  })
  it('tier 3 when the explorer is down', async () => {
    const { decision } = await run({ explorer: 'down' })
    expect(decision.tier).toBe(3); expect(decision.show).toContain('--serve-replay')
  })
  it('tier 3 when the explorer answers an error page', async () => {
    expect((await run({ explorer: 503 })).decision.tier).toBe(3)
  })
  it('tier 3 when no public Testnet node answers (and the key transaction check says so too)', async () => {
    const { decision, by } = await run({ node: 'down' })
    expect(decision.tier).toBe(3)
    expect(by('node').detail).toMatch(/no public Testnet node answered/)
    expect(by('key-tx').status).toBe('NO-GO')
  })
  it('stays tier 1 when only the second public node (clio) answers: the browser verifier falls back the same way', async () => {
    const { decision, by } = await run({ node: 'clio-only' })
    expect(decision.tier).toBe(1); expect(by('node').detail).toContain('clio.altnet.rippletest.net')
    expect(sockets).toEqual(expect.arrayContaining(NODES))
  })
  it('tier 3 beats tier 2: a paused sandbox with the explorer down is the replay', async () => {
    expect((await run({ hosted: { state: 'paused' }, explorer: 'down' })).decision.tier).toBe(3)
  })
  it('tier 4 when nothing remote answers: no network at all', async () => {
    const { decision, results } = await run({ hosted: 'down', explorer: 'down', node: 'down', pages: 500, release: { 'v1.1.0': 404, 'v1.1.1': 404 } })
    expect(decision.tier).toBe(4); expect(decision.say).toBe(TIERS[4].say)
    expect(results.filter(row => ['hosted', 'explorer', 'node', 'pages'].includes(row.id)).every(row => row.status === 'NO-GO')).toBe(true)
    expect(decision.fallbacks).toEqual([])
  })
  it('a missing release is advisory: it is shown as NO-GO and named, but does not change the tier', async () => {
    const { decision, by, results } = await run({ release: { 'v1.1.1': 404 } })
    expect(by('release-v1.1.1')).toMatchObject({ status: 'NO-GO', advisory: true })
    expect(by('release-v1.1.1').detail).toContain('researchagent-mcp-1.1.1.tgz: HTTP 404')
    expect(results.filter(row => row.id.startsWith('release-'))).toHaveLength(1)
    expect(decision.tier).toBe(1)
    expect(decision.notes.join(' ')).toMatch(/Release v1\.1\.1/)
  })
  it('a failed prepared key lookup selects the replay tier even when the node answers', async () => {
    for (const tx of ['not-found', 'wrong'] as const) {
      const { decision, by } = await run({ tx })
      expect(by('key-tx').status).toBe('NO-GO'); expect(by('key-tx').advisory).not.toBe(true)
      expect(decision.tier).toBe(3); expect(decision.show).not.toContain('EscrowFinish')
      expect(decision.fallbacks.some(f => f.tier === 2)).toBe(false)
    }
  })
  it('rejects the exact H10-08 supplied advisory key failure, and a missing key result', () => {
    const results: CheckResult[] = ['hosted', 'explorer', 'node', 'pages', 'receipts', 'replay', 'verify', 'deck', 'video'].map(id => ({ id, name: id, status: 'GO', detail: '' }))
    expect(decideTier([...results, { id: 'key-tx', status: 'NO-GO', advisory: true, name: 'key-tx', detail: '' }]).tier).toBe(3)
    expect(decideTier(results).tier).toBe(3)
    expect(decideTier([...results, { id: 'key-tx', status: 'GO', name: 'key-tx', detail: '' }]).tier).toBe(1)
  })
  it('does not offer tier 2 when paused and the prepared key is missing', async () => {
    expect((await run({ hosted: { state: 'paused' }, tx: 'not-found' })).decision.tier).toBe(3)
  })
  it('drops below the replay tier when its required verifier fails', async () => {
    const { decision } = await run({ tx: 'not-found', verify: { code: 1, output: 'RESULT FAIL' } })
    expect(decision.tier).toBe(4)
    expect(decision.notes.join(' ')).toContain('Tier 4 is NOT READY: missing offline verify')
  })
  it('a failing offline verify makes tiers 3 and 4 not ready, and says why', async () => {
    const { decision, by } = await run({ verify: { code: 1, output: 'FAIL receipt\nRESULT FAIL' } })
    expect(by('verify')).toMatchObject({ status: 'NO-GO' })
    expect(decision.tier).toBe(1)
    expect(decision.fallbacks.find(f => f.tier === 3)).toEqual({ tier: 3, ready: false, missing: ['offline verify'] })
    expect(decision.fallbacks.find(f => f.tier === 4)!.ready).toBe(false)
  })
  it('without --video the video is NOT CHECKED, never a pretend GO, and tier 4 is not ready', async () => {
    const dir = scratch()
    const results = await runChecks({ jarFile: join(dir, 'jar.json'), ms: 500 }, withReal(mocks()))
    const video = results.find(row => row.id === 'video')!
    expect(video.status).toBe('NOT CHECKED'); expect(video.detail).toContain('--video')
    expect(decideTier(results).fallbacks.find(f => f.tier === 4)).toEqual({ tier: 4, ready: false, missing: ['video MP4 (pass --video)'] })
  })
  it('a video path that does not exist is a NO-GO', async () => {
    const { by } = await run({}, { video: join(scratch(), 'nope.mp4') })
    expect(by('video').status).toBe('NO-GO')
  })
  it('gives each check its own 5 s, so one hung request cannot hold the others (here 50 ms)', async () => {
    const started = Date.now()
    const { by } = await run({ hosted: 'hang' }, { ms: 50 })
    expect(Date.now() - started).toBeLessThan(1500)
    expect(by('hosted').detail).toContain('no answer in 0.05 s'); expect(by('node').status).toBe('GO')
    expect(CHECK_MS).toBe(5000)
  })
  it('times out a hung promise and aborts what it started', async () => {
    let aborted = false
    await expect(timed(20, signal => new Promise(() => { signal.addEventListener('abort', () => { aborted = true }) }))).rejects.toThrow(/no answer in 0.02 s/)
    expect(aborted).toBe(true)
  })
})

describe('local media readiness', () => {
  it.each(['deck', 'video'] as const)('rejects empty, tiny, wrong-magic, missing and directory %s paths', id => {
    const dir = scratch(), file = join(dir, id === 'deck' ? 'deck.pdf' : 'video.mp4')
    const check = () => checkFiles({ deck: DEFAULTS.deck, video: undefined, [id]: file, receipts: DEFAULTS.receipts, evidence: DEFAULTS.evidence, exists: mocks().exists, readFile: readFileSync }).find(r => r.id === id)!
    expect(check().status).toBe('NO-GO')
    const corruptMagic = Buffer.from(id === 'deck' ? Buffer.from('%PDF-1.7') : mp4Header)
    corruptMagic[id === 'deck' ? 0 : 4] |= 0x80 // ASCII decoding must not disguise a wrong magic byte.
    for (const bytes of [Buffer.alloc(0), Buffer.from('x'), Buffer.alloc(2048), corruptMagic]) {
      writeFileSync(file, bytes)
      expect(check().status).toBe('NO-GO')
    }
    const directory = checkFiles({ deck: dir, video: dir, receipts: DEFAULTS.receipts, evidence: DEFAULTS.evidence, exists: mocks().exists, readFile: readFileSync })
    expect(directory.find(r => r.id === id)).toMatchObject({ status: 'NO-GO', detail: expect.stringContaining('not a regular file') })
  })
  it('rejects unreadable media even if stat succeeds', () => {
    const results = checkFiles({ deck: DEFAULTS.deck, video: DEFAULTS.deck, receipts: DEFAULTS.receipts, evidence: DEFAULTS.evidence, exists: mocks().exists, readFile: readFileSync, header: () => { throw new Error('EACCES') } })
    for (const id of ['deck', 'video']) expect(results.find(r => r.id === id)).toMatchObject({ status: 'NO-GO', detail: expect.stringContaining('EACCES') })
  })
  it('rejects truncated or impossible ftyp boxes and crossed media signatures', async () => {
    const dir = scratch(), file = join(dir, 'video.mp4')
    for (const hex of ['000000086674797069736f6d00000000', '000000FF6674797069736f6d00000000']) {
      writeFileSync(file, Buffer.from(hex, 'hex'))
      expect((await run({}, { video: file })).by('video').status).toBe('NO-GO')
    }
    writeFileSync(file, '%PDF-1.7' + ' '.repeat(24))
    expect((await run({}, { video: file })).by('video').status).toBe('NO-GO')
    writeFileSync(file, mp4Header)
    expect((await run({}, { deck: file })).by('deck').status).toBe('NO-GO')
  })
  it('accepts the real committed PDF and a signature-valid MP4 fixture', async () => {
    const { by, decision } = await run()
    expect(by('deck').status).toBe('GO'); expect(by('video').status).toBe('GO')
    expect(decision.fallbacks.find(f => f.tier === 4)!.ready).toBe(true)
  })
  it.each(['deck', 'video'] as const)('keeps tier 4 unready for a zero-byte %s', async id => {
    const file = join(scratch(), id); writeFileSync(file, '')
    const { decision, by } = await run({}, { [id]: file })
    expect(by(id).status).toBe('NO-GO')
    expect(decision.fallbacks.find(f => f.tier === 4)!.ready).toBe(false)
  })
})

// ---- never a hosted question, one cookie jar ---------------------------------------------------------------------------

describe('what it asks the hosted sandbox', () => {
  it('only GET /api/demo/status, nothing else, and never anything that could start or admit a run', async () => {
    calls.length = 0
    await run()
    const hosted = calls.filter(call => call.url.startsWith(DEFAULTS.hosted))
    expect(hosted).toEqual([{ method: 'GET', url: `${DEFAULTS.hosted}/api/demo/status`, cookie: undefined }])
    expect(calls.every(call => ['GET', 'HEAD'].includes(call.method))).toBe(true)
    expect(calls.map(call => call.url).join('\n')).not.toMatch(/\/api\/(runs|scope|ask|chat)|\/runs\b|POST/)
  })
  it('keeps ONE cookie jar: the session from the first run is sent back on the second, in a 0600 file', async () => {
    const dir = scratch(), jarFile = join(dir, 'jar.json')
    calls.length = 0
    await runChecks({ jarFile, ms: 500, video: undefined }, withReal(mocks()))
    expect(statSync(jarFile).mode & 0o777).toBe(0o600)
    expect(JSON.parse(readFileSync(jarFile, 'utf8'))).toEqual({ '__Host-ra_session': 'abc123' })
    await runChecks({ jarFile, ms: 500 }, withReal(mocks()))
    const status = calls.filter(call => call.url.endsWith('/api/demo/status'))
    expect(status.map(call => call.cookie)).toEqual([undefined, '__Host-ra_session=abc123'])
  })
  it('the cookie jar absorbs Set-Cookie, replaces a value, and drops an expired cookie', () => {
    const jar = cookieJar()
    jar.absorb({ headers: { getSetCookie: () => ['a=1; Path=/', 'b=2; HttpOnly'] } })
    jar.absorb({ headers: { getSetCookie: () => ['a=9', 'b=; Max-Age=0'] } })
    expect(jar.header()).toBe('a=9'); expect(jar.size).toBe(1)
    jar.absorb({ headers: {} })
    expect(jar.header()).toBe('a=9')
  })
  it('opens one read-only socket for the two ledger checks and closes it', async () => {
    sockets.length = 0; closed.length = 0
    await run()
    expect(sockets.filter(url => url === NODES[0])).toHaveLength(1)
    expect(closed).toEqual([NODES[0]])
    expect(KEY_TX).toMatch(/^01A6A7E0[0-9A-F]{56}$/)
  })
  it('closes an unfinished connection when the checks time out, without opening a fallback after returning', async () => {
    const opened: string[] = [], stopped: string[] = []
    class HangingSocket {
      constructor(public url: string) { opened.push(url) }
      addEventListener() {}
      close() { stopped.push(this.url) }
    }
    const deps = mocks()
    deps.WebSocket = HangingSocket
    const results = await runChecks({ ms: 20 }, deps)
    expect(results.find(row => row.id === 'node')!.status).toBe('NO-GO')
    expect(stopped).toEqual(opened)
    const count = opened.length
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(opened).toHaveLength(count)
    expect(stopped).toEqual(opened)
  })
})

// ---- the report --------------------------------------------------------------------------------------------------------

describe('the printed table', () => {
  it('has a GO / NO-GO row per check, marks advisory failures, and ends with the tier, the line to say and what is below it', async () => {
    const { results, decision } = await run({ release: { 'v1.1.1': 404 } })
    const text = renderReport(results, decision, { when: new Date('2026-11-18T09:50:00Z') })
    expect(text).toContain('18 Nov 2026, 17:50 SGT')
    expect(text).toMatch(/Sandbox status \(GET \/api\/demo\/status only\)\s+GO/)
    expect(text).toMatch(/Release v1\.1\.1 .*\s+NO-GO \*/)
    expect(text).toContain('* advisory: it does not change the tier')
    expect(text).toContain('USE TIER 1 · Live')
    expect(text).toContain(`Say:  "${TIERS[1].say}"`)
    expect(text).toContain('Below it: tier 2 ready · tier 3 ready · tier 4 ready')
  })
  it('main() prints the table and exits 0 only for tier 1; --json prints the same decision', async () => {
    const out: string[] = []
    const dir = scratch(), video = join(dir, 'v.mp4'); writeFileSync(video, mp4Header)
    const code = await main(['--video', video, '--jar', join(dir, 'jar.json'), '--timeout', '500'], withReal(mocks()), { out: t => out.push(t), err: t => out.push(t) })
    expect(code).toBe(0); expect(out.join('\n')).toContain('USE TIER 1 · Live')
    out.length = 0
    const paused = await main(['--video', video, '--jar', join(dir, 'jar.json'), '--json', '--timeout', '500'], withReal(mocks({ hosted: { state: 'paused' } })), { out: t => out.push(t), err: t => out.push(t) })
    expect(paused).toBe(1)
    expect(JSON.parse(out.join('\n')).decision).toMatchObject({ tier: 2, name: 'Sandbox down' })
  })
  it('rejects bad options with exit 2 and a reason', async () => {
    const err: string[] = []
    for (const argv of [['--hosted', 'http://evil.example'], ['--timeout', '99999'], ['--timeout', 'x'], ['--nope'], ['--video']]) expect(await main(argv, mocks(), { out: () => undefined, err: t => err.push(t) })).toBe(2)
    expect(err).toHaveLength(5)
    expect(parseArgs(['--hosted', 'https://ra.example', '--timeout', '3000']).ms).toBe(3000)
    expect(parseArgs(['--hosted', 'http://127.0.0.1:9999']).hosted).toBe('http://127.0.0.1:9999')
  })
})

// ---- --serve-replay ----------------------------------------------------------------------------------------------------

const get = (port: number, path: string, method = 'GET') => new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }>((done, fail) => {
  const req = httpRequest({ host: '127.0.0.1', port, path, method }, res => { let body = ''; res.on('data', c => { body += c }); res.on('end', () => done({ status: res.statusCode ?? 0, headers: res.headers, body })) })
  req.on('error', fail); req.end()
})
describe('--serve-replay', () => {
  const build = () => {
    const dir = scratch()
    mkdirSync(join(dir, 'assets'), { recursive: true })
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>replay</title><script type="module" src="/theFastandtheFungible/demo/assets/app.js"></script>')
    writeFileSync(join(dir, 'assets', 'app.js'), 'export {}')
    writeFileSync(join(dir, 'secret.txt'), 'outside the build? no: inside, but only /demo/ paths are served')
    return dir
  }
  it('listens on an ephemeral port of 127.0.0.1 only, never on 5100, 8788 or 8790', async () => {
    const server = await serveReplay({ dir: build() })
    try {
      expect(FORBIDDEN_PORTS).toEqual([5100, 8788, 8790])
      expect(FORBIDDEN_PORTS).not.toContain(server.port)
      expect(server.port).toBeGreaterThan(1023)
      expect(server.url).toBe(`http://127.0.0.1:${server.port}${REPLAY_BASE}`)
    } finally { await server.close() }
    const source = readFileSync(join(ROOT, 'scripts/stage-check.mjs'), 'utf8')
    expect(source.match(/\.listen\(([^,)]+)/g)).toEqual(['.listen(0'])
  })
  it('serves the replay with a CSP that stops the page reaching anything outside this machine', async () => {
    const server = await serveReplay({ dir: build() })
    try {
      const page = await get(server.port, REPLAY_BASE)
      expect(page.status).toBe(200); expect(page.body).toContain('<title>replay</title>')
      expect(page.headers['content-security-policy']).toBe(REPLAY_CSP)
      expect(REPLAY_CSP).toMatch(/default-src 'self'/); expect(REPLAY_CSP).toMatch(/connect-src 'self'/); expect(REPLAY_CSP).not.toMatch(/https?:|\*/)
      const script = await get(server.port, `${REPLAY_BASE}assets/app.js`)
      expect(script.status).toBe(200); expect(script.headers['content-type']).toContain('javascript'); expect(script.headers['content-security-policy']).toBe(REPLAY_CSP)
      expect((await get(server.port, '/')).headers.location).toBe(REPLAY_BASE)
      expect((await get(server.port, REPLAY_BASE, 'HEAD')).body).toBe('')
    } finally { await server.close() }
  })
  it('refuses path traversal, anything outside /demo/, missing files and every method but GET and HEAD', async () => {
    const server = await serveReplay({ dir: build() })
    try {
      for (const path of [`${REPLAY_BASE}../../../etc/passwd`, `${REPLAY_BASE}..%2f..%2f..%2fetc%2fpasswd`, `${REPLAY_BASE}%2e%2e/%2e%2e/etc/passwd`, '/etc/passwd', '/theFastandtheFungible/other', `${REPLAY_BASE}nope.js`]) {
        const reply = await get(server.port, path)
        expect([400, 404], path).toContain(reply.status); expect(reply.body, path).not.toMatch(/root:|secret/)
      }
      expect((await get(server.port, REPLAY_BASE, 'POST')).status).toBe(405)
      expect((await get(server.port, REPLAY_BASE, 'PUT')).status).toBe(405)
    } finally { await server.close() }
  })
  it('says so when there is no build to serve', async () => {
    await expect(serveReplay({ dir: scratch() })).rejects.toThrow(/no replay build/)
  })
})
