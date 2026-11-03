import { describe, it, expect, vi } from 'vitest'
// @ts-expect-error Electron runtime module is plain ESM.
import { bootSecrets } from '../desktop/recovery.mjs'
// @ts-expect-error Electron runtime module is plain ESM.
import { defaults, settings, engineEnv, providerOrigin, trustedSender } from '../desktop/policy.mjs'
import { readFileSync } from 'node:fs'
import { Store } from '../server/store'

describe('desktop recovery configuration', () => {
  for (const name of ['fresh start', 'explicit offline']) it(`${name} never reads Keychain`, async () => {
    const read = vi.fn(() => { throw new Error('must not read') })
    expect(await bootSecrets({ ...defaults, mcpEnabled: true }, read)).toEqual({})
    expect(read).not.toHaveBeenCalled()
  })
  for (const kind of ['missing', 'deleted', 'locked', 'denied', 'corrupt']) it(`${kind} key is recoverable`, async () => {
    const read = async () => { if (['missing', 'deleted'].includes(kind)) return undefined; throw new Error(kind) }
    await expect(bootSecrets({ ...defaults, live: true }, read)).rejects.toThrow()
  })
  it('remote token absent is recoverable', async () => {
    await expect(bootSecrets({ ...defaults, backend: 'remote' }, async () => undefined)).rejects.toThrow('Remote token missing')
  })
  for (const provider of ['deepseek', 'openai', 'openai-compatible']) it(`passes ${provider} through the exact engine contract`, async () => {
    const preferences = settings({ ...defaults, live: true, provider, baseUrl: 'https://api.openai.com/v1', model: 'synthetic', sameKeyDecisions: true })
    const secrets = await bootSecrets(preferences, async () => 'synthetic')
    const env = engineEnv({ userData: '/tmp/test', preferences, secrets })
    expect(env.LLM_PROVIDER).toBe(provider)
    expect(env.LLM_API_KEY).toBe('synthetic')
    expect(env.DECISION_PROVIDER).toBe('compatible')
    expect(env.LLM_MODEL).toBe('synthetic')
  })
  it('structural validation refuses unsafe endpoints without transport', () => {
    for (const value of ['http://example.com', 'https://127.0.0.1', 'https://169.254.169.254', 'https://api.openai.com/?key=x', 'https://user:pass@api.openai.com', 'https://arbitrary.example/v1']) expect(() => providerOrigin(value)).toThrow()
    expect(providerOrigin('http://127.0.0.1:1234/v1')).toBe('http://127.0.0.1:1234/v1')
    expect(() => settings({ ...defaults, live: true, provider: 'openai-compatible' })).toThrow()
  })
  it('cached preferences cannot write wallet pause during boot/reconnect', () => {
    const source = readFileSync('desktop/main.mjs', 'utf8')
    expect(source).not.toContain('paused: preferences.paused')
    expect(source).not.toContain('paused: next.paused')
    expect(source).not.toContain('app.exit(1)')
    expect(source.indexOf("ipcMain.handle(`recovery:")).toBeLessThan(source.indexOf('void connectEngine()\n}'))
    const env = engineEnv({ userData: '/tmp/test', preferences: { ...defaults, paused: false } })
    expect(env.SPENDING_PAUSED).toBe(process.env.SPENDING_PAUSED === '1' ? '1' : '0')
  })
  it('engine Store records an explicit durable pause', () => {
    // Native packaged smoke verifies SDK transport and worker/app restarts too.
    const store = new Store(':memory:')
    store.setPaused(true, { surface: 'operator', principal: 'test' })
    expect(store.walletStatus().paused).toBe(true)
    store.close()
  })
  it('denies subframe and malformed IPC senders', () => {
    expect(trustedSender({ senderFrame: null, sender: {} })).toBe(false)
    const frame = { url: 'app://researchagent/preferences' }
    expect(trustedSender({ senderFrame: frame, sender: { mainFrame: {} } })).toBe(false)
  })
})

const native = vi.hoisted(() => ({ values: new Map<string, string>(), failWrite: false, failDelete: false }))
vi.mock('node:child_process', async () => {
  const { EventEmitter } = await import('node:events')
  return {
    execFile: (_cmd: string, args: string[], _options: unknown, callback: (error: unknown, value?: unknown) => void) => {
      const account = args[args.indexOf('-a') + 1]
      if (args[0] === 'delete-generic-password') {
        if (native.failDelete) return callback({ code: 1 })
        native.values.delete(account); return callback(null, { stdout: '' })
      }
      const value = native.values.get(account)
      return value ? callback(null, { stdout: Buffer.from(JSON.stringify({ network: 'xrpl:1', value })).toString('base64') }) : callback({ code: 44 })
    },
    spawn: () => {
      const child = new EventEmitter() as import('node:events').EventEmitter & { stdin: import('node:events').EventEmitter & { end: (text: string) => void } }
      child.stdin = Object.assign(new EventEmitter(), { end: (text: string) => {
        const account = text.match(/-a (\S+)/)![1]
        const record = text.match(/-w (\S+)/)![1]
        if (!native.failWrite) native.values.set(account, JSON.parse(Buffer.from(record, 'base64').toString()).value)
        queueMicrotask(() => child.emit('exit', native.failWrite ? 1 : 0))
      } })
      return child
    },
  }
})
describe('presence-only Keychain mutations with mocked native command (never real service)', () => {
  it('save, replace, delete, repeated delete, failed write and failed delete retain correct presence', async () => {
    // @ts-expect-error Plain ESM main-process module.
    const { writeSecret, deleteSecret, secretPresence } = await import('../desktop/keychain.mjs')
    await writeSecret('compatible', 'synthetic-one')
    expect(await secretPresence('compatible')).toEqual({ present: true, available: true })
    await writeSecret('compatible', 'synthetic-two')
    expect(native.values.get('compatible')).toBe('synthetic-two')
    native.failWrite = true
    await expect(writeSecret('compatible', 'synthetic-three')).rejects.toThrow()
    expect(native.values.get('compatible')).toBe('synthetic-two')
    native.failDelete = true
    await expect(deleteSecret('compatible')).rejects.toThrow()
    expect(await secretPresence('compatible')).toEqual({ present: true, available: true })
    native.failDelete = false; native.failWrite = false
    expect(await deleteSecret('compatible')).toEqual({ present: false, available: true })
    expect(await deleteSecret('compatible')).toEqual({ present: false, available: true })
    await expect(deleteSecret('xrpl-payer')).rejects.toThrow()
  })
})

describe('backend recovery failures', () => {
  it('remote outage and boot timeout reject without credential reflection', async () => {
    // @ts-expect-error Plain ESM desktop transport.
    const { backendRequest } = await import('../desktop/backend.mjs')
    for (const message of ['remote outage', 'boot timeout']) {
      await expect(backendRequest({ apiUrl: 'https://example.invalid', apiToken: 'synthetic' }, '/health', {}, async () => { throw new Error(message) })).rejects.toThrow(message)
    }
  })
  it('emergency env ceiling survives cached resume preference', () => {
    vi.stubEnv('SPENDING_PAUSED', '1')
    try {
      expect(engineEnv({ userData: '/tmp/test', preferences: { ...defaults, paused: false } }).SPENDING_PAUSED).toBe('1')
    } finally { vi.unstubAllEnvs() }
  })
})

describe('provider connection IPC transport', () => {
  it('uses the engine key only in auth and preserves measured usage/null cost', async () => {
    // @ts-expect-error Plain ESM desktop transport.
    const { testProvider } = await import('../desktop/backend.mjs')
    const seen: { body?: string; headers?: Record<string, string> }[] = []
    for (const costUsd of [null, 0.004]) {
      const result = await testProvider({ apiUrl: 'http://127.0.0.1:1234', apiToken: 'synthetic' }, { backend: 'local', baseUrl: 'https://api.openai.com/v1', model: 'synthetic' }, async (_url: URL, init: { body?: string; headers?: Record<string, string> }) => { seen.push(init); return Response.json({ ok: true, latencyMs: 12, inputTokens: 1000, outputTokens: 500, costUsd, secret: 'must-not-cross' }) })
      expect(result.costUsd).toBe(costUsd)
      expect(result.inputTokens).toBe(1000)
      expect(result).not.toHaveProperty('secret')
    }
    expect(seen[0].body).toBe(JSON.stringify({ baseUrl: 'https://api.openai.com/v1', model: 'synthetic' }))
    expect(seen[0].headers?.Authorization).toBe('Bearer synthetic')
  })
  it('missing engine/endpoint return engine unavailable', async () => {
    // @ts-expect-error Plain ESM desktop transport.
    const { testProvider } = await import('../desktop/backend.mjs')
    const transport = vi.fn(async () => new Response('', { status: 404 }))
    expect((await testProvider(undefined, { backend: 'local' }, transport)).error.code).toBe('engine_unavailable')
    expect(transport).not.toHaveBeenCalled()
    expect((await testProvider({ apiUrl: 'http://127.0.0.1:1234' }, { backend: 'local' }, transport)).error.code).toBe('engine_unavailable')
  })
})
