import { backendRequest } from '../desktop/backend.mjs'
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CSP, LEDGER_ORIGINS, engineEnv, settings, localRequest, trustedSender, remoteOrigin, allowedRequest, acceptableProofCsp, responseHeaders, isProofPage, proofWindowUrl } from '../desktop/policy.mjs'
import { LEDGER_HOSTS, proofCsp } from '../server/proof-page.js'

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
    expect(env.MCP_MAX_BUDGET_MINOR).toBe('200') // Cached pause cannot control durable wallet authority.
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

describe('authenticated desktop transport', () => {
  it('forwards auth from main to the API and stream, never to the publisher', async () => {
    const seen = []
    const transport = async (url, init) => { seen.push({ url: url.href, ...init }); return new Response('{}') }
    const engine = { apiUrl: 'https://backend.example', publisherUrl: 'https://writer.example', apiToken: 'synthetic-token' }
    await backendRequest(engine, '/runs/id/events', {}, transport)
    await backendRequest(engine, '/runs', { method: 'POST', body: '{}' }, transport)
    await backendRequest(engine, '/w/example', {}, transport)
    expect(seen[0].headers.Authorization).toBe('Bearer synthetic-token')
    expect(seen[1].headers.Authorization).toBe('Bearer synthetic-token')
    expect(seen[0].redirect).toBe('error')
    expect(seen[2].url).toBe('https://writer.example/w/example')
    expect(seen[2].headers).not.toHaveProperty('Authorization')
    expect(seen.every(item => !item.url.includes('synthetic-token'))).toBe(true)
  })
  it('accepts HTTPS origins and refuses credential URLs, paths and insecure remote hosts', () => {
    expect(remoteOrigin('https://backend.example/')).toBe('https://backend.example')
    for (const value of ['http://backend.example', 'https://user:secret@backend.example', 'https://backend.example/path', 'https://backend.example/?token=secret']) expect(() => remoteOrigin(value)).toThrow()
  })
})


it('fixture Settings never enables escrow while Testnet retains the selected mode', () => {
  const preferences = { live: false, paused: false, maxMinor: 0, dailyMinor: 0, ESCROW_MODE: 'key-reveal' }
  expect(engineEnv({ userData: '/tmp/desktop-test', preferences }).ESCROW_MODE).toBe('payment')
  expect(engineEnv({ userData: '/tmp/desktop-test', preferences: { ...preferences, live: true } }).ESCROW_MODE).toBe('key-reveal')
})

// S3 (11 Nov): the proof page and the in-browser verifier inside the Mac app. The shell stays deny-by-default; the only
// network a renderer gets is the two public Testnet nodes the verifier already names, over WebSocket, read-only.
const NONCE = 'q83Hh0aZb1x7Tn2RkP0w5g=='
const PROOF_ID = 'a'.repeat(32)
const directive = (policy, name) => policy.split(';').map(part => part.trim().split(/\s+/)).find(([key]) => key === name)?.slice(1)

describe('desktop shell policy', () => {
  it('keeps the shell deny-by-default: no inline script, no wildcard, only the two Testnet nodes beyond itself', () => {
    expect(CSP).toBe("default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' wss://s.altnet.rippletest.net:51233 wss://clio.altnet.rippletest.net:51233; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
    expect(directive(CSP, 'script-src')).toEqual(["'self'"])
    expect(directive(CSP, 'connect-src')).toEqual(["'self'", ...LEDGER_ORIGINS])
    expect(CSP).not.toMatch(/\*|unsafe-eval|https?:|ws:\/\//)
  })
  it('names the same two nodes as the proof page and the in-browser verifier', () => {
    expect([...LEDGER_ORIGINS]).toEqual(LEDGER_HOSTS)
    expect(readFileSync('src/verify/browser.ts', 'utf8')).toContain(`LEDGER_ENDPOINTS = [${LEDGER_ORIGINS.map(origin => `'${origin}'`).join(', ')}] as const`)
  })
  it('cancels every renderer request except the app itself and those two WebSocket origins', () => {
    for (const url of ['app://researchagent/', 'app://researchagent/proof/abc', 'wss://s.altnet.rippletest.net:51233', 'wss://s.altnet.rippletest.net:51233/', 'wss://clio.altnet.rippletest.net:51233']) expect(allowedRequest(url), url).toBe(true)
    for (const url of ['https://example.com', 'wss://example.com/', 'ws://s.altnet.rippletest.net:51233', 'https://s.altnet.rippletest.net:51233', 'wss://s.altnet.rippletest.net:51234', 'wss://s.altnet.rippletest.net', 'wss://s.altnet.rippletest.net:51233/ws',
      'wss://s.altnet.rippletest.net:51233/?x=1', 'wss://user@s.altnet.rippletest.net:51233', 'wss://s.altnet.rippletest.net.evil.example:51233', 'wss://evil.example:51233@s.altnet.rippletest.net:51233.evil/', 'wss://xrplcluster.com',
      'wss://s1.ripple.com', 'https://testnet.xrpl.org/', 'app://other/', 'app://researchagent.evil/', 'file:///etc/passwd', 'data:text/html,x', 'not a url']) expect(allowedRequest(url), url).toBe(false)
  })
})

describe('desktop proof page headers', () => {
  const page = `/proof/${PROOF_ID}`
  it('serves /proof/<id> with the server’s own policy, unchanged and alone (so its nonce’d script can run)', () => {
    const served = proofCsp(NONCE)
    const headers = responseHeaders(page, new Headers({ 'content-security-policy': served, 'content-type': 'text/html; charset=utf-8', 'referrer-policy': 'no-referrer' }))
    expect(headers.get('content-security-policy')).toBe(served) // not "…, default-src 'none'; script-src 'self'…"
    expect(headers.get('content-security-policy')).not.toContain(',')
    expect(headers.get('content-security-policy')).toContain(`script-src 'self' 'nonce-${NONCE}'`)
    expect(headers.get('x-content-type-options')).toBe('nosniff'); expect(headers.get('cache-control')).toBe('no-store')
    expect(headers.get('referrer-policy')).toBe('no-referrer'); expect(headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(isProofPage(page)).toBe(true)
  })
  it('the policy it passes through is deny-by-default with no inline allowance and no wildcard', () => {
    const served = proofCsp(NONCE)
    expect(acceptableProofCsp(served)).toBe(true)
    expect(directive(served, 'default-src')).toEqual(["'none'"])
    expect(directive(served, 'script-src')).toEqual(["'self'", `'nonce-${NONCE}'`])
    expect(directive(served, 'connect-src')).toEqual(["'self'", ...LEDGER_ORIGINS])
    expect(served).not.toMatch(/unsafe-|\*/)
  })
  it('falls back to the shell policy, added to whatever the backend sent, when there is none or it is looser', () => {
    expect(responseHeaders(page, new Headers()).get('content-security-policy')).toBe(CSP)
    for (const hostile of [`${proofCsp(NONCE)}; script-src *`, proofCsp(NONCE).replace(/script-src [^;]+/, "script-src 'self' 'unsafe-inline'"), proofCsp(NONCE).replace("connect-src 'self'", "connect-src 'self' https://evil.example"),
      proofCsp(NONCE).replace("default-src 'none'", 'default-src *'), proofCsp(NONCE).replace(NONCE, 'x'), "default-src 'none'; script-src 'self'; img-src https:", "script-src 'self' 'nonce-" + NONCE + "'", `${proofCsp(NONCE)}, default-src *`, '']) {
      expect(acceptableProofCsp(hostile), hostile).toBe(false)
      const headers = responseHeaders(page, new Headers(hostile ? { 'content-security-policy': hostile } : {}))
      expect(headers.get('content-security-policy')?.endsWith(CSP), hostile).toBe(true) // the browser applies both, so a backend can only narrow it
    }
  })
  it('gives every other response the shell policy: the app, its API, the receipts download, the proof card, other proof-like paths', () => {
    const backend = new Headers({ 'content-security-policy': proofCsp(NONCE), 'content-type': 'application/json' })
    for (const path of ['/', '/api/runs', '/runs/abc/report.html', '/health', `${page}/receipts.json`, `${page}/card.html`, `${page}/`, '/proof', '/proof/', `/proof/${PROOF_ID}/x/y`, '/w/writer']) {
      expect(isProofPage(path), path).toBe(false)
      const final = responseHeaders(path, backend).get('content-security-policy')
      expect(final, path).toBe(`${proofCsp(NONCE)}, ${CSP}`)
    }
    // A bundled file has no backend policy: exactly the shell's, once.
    expect(responseHeaders('/assets/app.js').get('content-security-policy')).toBe(CSP)
    expect(responseHeaders('/').get('x-content-type-options')).toBe('nosniff')
  })
  it('opens only a real proof page of this app in its own window', () => {
    expect(proofWindowUrl(`app://researchagent${page}`)?.pathname).toBe(page)
    for (const url of [`app://researchagent${page}?settings=1`, `app://researchagent${page}#x`, `app://researchagent${page}/card.html`, 'app://researchagent/proof/xyz', `https://demo.example${page}`, `app://evil${page}`, `app://u:p@researchagent${page}`, 'app://researchagent/settings', 'nope']) expect(proofWindowUrl(url), url).toBeUndefined()
  })
  it('the shell wires these functions in, and does not reintroduce a second policy or a looser request filter', () => {
    const main = readFileSync('desktop/main.mjs', 'utf8')
    expect(main).toContain('responseHeaders(url.pathname, response.headers)')
    expect(main).toContain('allowedRequest(details.url)')
    expect(main).not.toMatch(/Content-Security-Policy|startsWith\(`\$\{ORIGIN\}\/`\) }\)\)/)
    expect(main).toContain('proofWindowUrl(url)')
  })
})
