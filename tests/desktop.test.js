import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CSP, engineEnv, settings, localRequest, trustedSender } from '../desktop/policy.mjs'

describe('desktop boundary', () => {
  it('isolates fixture mode from inherited provider credentials and network overrides', () => {
    const seed = ['secret', 'wallet', 'value'].join('-')
    const env = engineEnv({ userData: '/tmp/desktop-test', preferences: { live: false, paused: false, maxMinor: 200, dailyMinor: 500 }, secrets: { 'xrpl-payer': seed, deepseek: seed, XRPL_PUBLISHER_EXAMPLE_SEED: seed } })
    expect(JSON.stringify(env)).not.toContain(seed)
    expect(env.LLM_PROVIDER).toBe('fixture')
    expect(env.RA_DATA_DIR.endsWith('/fixture')).toBe(true)
    expect(env.NODE_OPTIONS).toBeUndefined()
    expect(env.XRPL_RPC_URL).toBe('wss://s.altnet.rippletest.net:51233')
    expect(env.DOTENV_CONFIG_PATH).toBe('/dev/null')
  })
  it('rejects rebinding hosts, browser mutations, and untrusted IPC frames', () => {
    expect(localRequest({ headers: { host: '127.0.0.1:12345' } }, 12345)).toBe(true)
    expect(localRequest({ headers: { host: 'evil.example:12345' } }, 12345)).toBe(false)
    expect(localRequest({ headers: { host: '127.0.0.1:12345', origin: 'https://evil.example' } }, 12345)).toBe(false)
    const frame = { url: 'https://evil.example' }
    expect(trustedSender({ senderFrame: frame, sender: { mainFrame: frame } })).toBe(false)
    expect(CSP).toContain("script-src 'self'")
    expect(CSP).toContain("connect-src 'self'")
  })
  it('validates caps and strips unapproved settings rather than persisting secrets', () => {
    const input = { live: false, paused: true, maxMinor: 200, dailyMinor: 500, seed: 'do-not-persist' }
    expect(settings(input)).not.toHaveProperty('seed')
    expect(() => settings({ ...input, maxMinor: 501 })).toThrow()
    expect(() => settings({ ...input, dailyMinor: -1 })).toThrow()
    const env = engineEnv({ userData: '/tmp/test', preferences: input })
    expect(env.MCP_MAX_BUDGET_MINOR).toBe('0')
  })
  it('keeps secret reads and wallet generation in main; no seed in preload or persistence code', () => {
    const preload = readFileSync('desktop/preload.cjs', 'utf8')
    expect(preload).not.toMatch(/readSecret|XRPL_PAYER_SEED|fromSeed|process\.env/)
    const main = readFileSync('desktop/main.mjs', 'utf8')
    expect(main).not.toMatch(/console\.(?:log|error)\([^\n]*(?:seed|secrets|env)/)
    expect(main).toContain("nodeIntegration: false, sandbox: true")
    const keychain = readFileSync('desktop/keychain.mjs', 'utf8')
    expect(keychain).toContain("['-i']")
    expect(keychain).toContain("stdio: ['pipe', 'ignore', 'ignore']")
    expect(keychain).not.toMatch(/writeFile|console\./)
  })
})
