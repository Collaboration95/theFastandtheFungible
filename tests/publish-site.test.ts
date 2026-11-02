import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Wallet } from 'xrpl'
import { publishSite } from '../publisher/publishing/publish.js'
import { markdownCorpus, parseMarkdown } from '../publisher/publishing/markdown.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { loadLocalWriters } from '../publisher/local-writers.js'
import { seedEnvName } from '../publisher/registry.js'
import { PublisherClient } from '../server/publisher-client.js'
import { retrieve } from '../server/agents/research.js'
import { PurchaseManager } from '../server/purchases.js'
import { RunLoop } from '../server/agents/loop.js'
import { Store } from '../server/store.js'
import { sharesRun } from '../shared/contracts/writers.js'
import { verifyManifestSignature } from '../shared/manifest.js'

const cleanup: (() => unknown)[] = []
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); vi.unstubAllEnvs() })
async function temporary() {
  const root = await mkdtemp(join(tmpdir(), 'publish-site-'))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  return root
}
async function publish(rail: 'simulated' | 'xrpl-testnet' = 'simulated', fund = vi.fn(async () => {})) {
  const root = await temporary()
  const logs: string[] = []
  const site = await publishSite({ folder: 'examples/writer-starter', slug: 'test-writer', root, port: 0, rail, env: {}, fund, log: line => logs.push(line) })
  cleanup.push(() => new Promise<void>(done => { site.server.closeAllConnections(); site.server.close(() => done()) }))
  return { ...site, root, logs, fund, client: new PublisherClient({ baseUrl: site.baseUrl }) }
}

describe('Markdown folder → paid writer (#277)', () => {
  it('starts under 60s, registers, discovers, signs, buys via fixture policy, verifies proof and charges once', async () => {
    const site = await publish()
    expect(site.seconds).toBeLessThan(60)
    const registry = await site.client.registry()
    expect(registry).toMatchObject([{ slug: 'test-writer', verification: 'unverified writer' }])
    const corpus = (await loadLocalWriters(site.root))[0]
    expect(corpus.articles).toHaveLength(3)
    const retrieved = await retrieve(site.client, 'Malaysia colocation firm supply solar energy')
    const candidate = retrieved.candidates.find(c => c.tier === 'PAID')!
    expect(candidate.verification).toBe('unverified writer')
    expect(verifyManifestSignature(candidate.manifest!)).toBe(true)
    expect(candidate.manifest!.schemaVersion).toBe(2)
    expect(candidate.manifest!.claims.some(c => c.covers)).toBe(true)
    for (const claim of candidate.manifest!.claims) for (const field of Object.values(claim.covers ?? {})) expect(field).not.toMatch(/\d/)
    const unpaid = await fetch(site.baseUrl + candidate.url)
    expect(unpaid.status).toBe(402)
    expect(sharesRun(await unpaid.text(), corpus.articles[0].body)).toBe(false)
    const store = new Store(':memory:'); cleanup.push(() => store.close())
    const manager = new PurchaseManager(store, site.client)
    const run = store.createRun('What share of electricity comes from solar renewable contracts for a Malaysia colocation facility?', 10)
    const loop = new RunLoop(store, site.client, manager)
    await loop.start(run.runId)
    const result = store.getRun(run.runId)
    expect(result.intents).toHaveLength(1)
    expect(result.intents[0].status).toBe('VERIFIED')
    expect(result.spentMinor).toBe(10)
    expect(result.grants).toHaveLength(1)
    const paidCandidate = result.candidates.find(c => c.resourceId === result.intents[0].resourceId)!
    await manager.purchase({ runId: run.runId, candidate: paidCandidate, intentId: result.intents[0].intentId })
    expect(store.getRun(run.runId).receipts).toHaveLength(1)
  })

  it('the repo bin starts on an ephemeral port and exits cleanly on SIGTERM', async () => {
    const root = await temporary()
    const child = spawn(process.execPath, ['scripts/publish-site.mjs', 'examples/writer-starter', '--slug', 'bin-writer', '--rail', 'simulated', '--port', '0'], {
      env: { ...process.env, LOCAL_WRITERS_DIR: root, SEARCH_EMBEDDINGS: 'off', PUBLISHER_FAULTS: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    const exited = once(child, 'exit')
    try {
      await new Promise<void>((done, reject) => {
        const timer = setTimeout(() => reject(new Error('CLI did not become ready')), 8000)
        child.stdout.on('data', chunk => { output += String(chunk); if (output.includes('Folder → searchable, payable writer:')) { clearTimeout(timer); done() } })
        child.once('exit', code => { clearTimeout(timer); if (!output.includes('Folder →')) reject(new Error(`CLI exited ${code}`)) })
      })
      child.kill('SIGTERM')
      expect((await exited)[0]).toBe(0)
      expect(output).toContain('SIMULATED')
      vi.stubEnv('LOCAL_WRITERS_DIR', root)
      expect((await loadWriterCorpus()).publishers.some(p => p.slug === 'bin-writer')).toBe(true)
    } finally { if (child.exitCode === null) child.kill('SIGKILL') }
  }, 10000)

  it('labels real author content separately from synthetic starters', async () => {
    const root = await temporary()
    const folder = join(root, 'input'); await mkdir(folder)
    await writeFile(join(folder, 'article.md'), (await readFile('examples/writer-starter/1-capacity.md', 'utf8')).replace('synthetic: true', 'synthetic: false'))
    const site = await publishSite({ folder, slug: 'real-author', root: join(root, 'writers'), port: 0, rail: 'simulated', env: {}, log: () => {} })
    cleanup.push(() => new Promise<void>(done => { site.server.closeAllConnections(); site.server.close(() => done()) }))
    const client = new PublisherClient({ baseUrl: site.baseUrl })
    expect((await client.registry())[0]).toMatchObject({ synthetic: false, verification: 'unverified writer' })
    const candidate = (await retrieve(client, 'solar electricity')).candidates[0]
    expect(candidate.license.kind).toBe('AUTHOR SUPPLIED')
    const html = await (await fetch(site.baseUrl + '/w/real-author/')).text()
    expect(html).toContain('AUTHOR SUPPLIED · unverified writer')
    expect(html).not.toContain('SYNTHETIC · fictional writer')
  })

  it('runs the eight-word leak oracle against every new paid body, including body queries and HTML', async () => {
    const site = await publish()
    const paid = site.corpus.articles.filter(a => a.tier === 'PAID')
    const queries = ['Malaysia colocation energy', ...paid.map(a => a.body.split(/\s+/).slice(0, 30).join(' ').slice(0, 300))]
    for (const q of queries) {
      const response = await fetch(`${site.baseUrl}/w/test-writer/search?${new URLSearchParams({ q, k: '10' })}`)
      expect(response.ok).toBe(true)
      const raw = await response.text()
      for (const a of paid) expect(sharesRun(raw, a.body)).toBe(false)
    }
    for (const a of paid) {
      const html = await (await fetch(`${site.baseUrl}/w/test-writer/blog/${a.articleId}`)).text()
      expect(sharesRun(html, a.body)).toBe(false)
    }
  })

  it('saves a private Testnet key before funding, reuses it after a failure, and never logs seeds', async () => {
    const root = await temporary()
    const logs: string[] = []
    const options = { folder: 'examples/writer-starter', slug: 'funding-retry', root, port: 0, env: {}, log: (s: string) => logs.push(s) }
    await expect(publishSite({ ...options, fund: async () => { throw new Error('faucet unavailable') } })).rejects.toThrow('faucet')
    const keyFile = join(root, 'funding-retry', '.env.writer')
    const key = await readFile(keyFile, 'utf8')
    expect((await stat(keyFile)).mode & 0o777).toBe(0o600)
    const fund = vi.fn(async (wallet: Wallet) => { expect(key).toContain(wallet.seed) })
    const site = await publishSite({ ...options, fund })
    cleanup.push(() => new Promise<void>(done => { site.server.closeAllConnections(); site.server.close(() => done()) }))
    expect(fund).toHaveBeenCalledOnce()
    expect(await readFile(keyFile, 'utf8')).toBe(key)
    expect(logs.join('\n')).not.toContain(key.split('=')[1].trim())
  })

  it('screens the new payee at purchase time and never signs a denied wallet', async () => {
    const site = await publish()
    const candidate = (await retrieve(site.client, 'Malaysia colocation energy')).candidates.find(c => c.tier === 'PAID')!
    const file = join(site.root, 'denylist.json')
    await writeFile(file, JSON.stringify([{ address: candidate.wallet, reason: 'test operator rule' }]))
    vi.stubEnv('PAYEE_DENYLIST_FILE', file)
    const store = new Store(':memory:'); cleanup.push(() => store.close())
    const run = store.createRun('Energy', 10)
    const manager = new PurchaseManager(store, site.client)
    const sign = vi.spyOn(manager.payer, 'pay')
    const intent = await manager.purchase({ runId: run.runId, candidate, intentId: 'denied' })
    expect(intent.error).toContain('operator denylist')
    expect(sign).not.toHaveBeenCalled()
    expect(store.getRun(run.runId).spentMinor).toBe(0)
    expect(store.getSubmission('denied')).toBeUndefined()
  })

  it('refuses Mainnet, bad metadata, premium abstracts and invalid tier prices before funding', async () => {
    const corpus = await markdownCorpus('examples/writer-starter', 'validation', 'Validation')
    const source = await readFile('examples/writer-starter/1-capacity.md', 'utf8')
    expect(() => parseMarkdown(source.replace('price: 0.10', 'price: nope'), 'validation', 'bad')).toThrow('price')
    expect(() => parseMarkdown(source.replace(/abstract: .*/, `abstract: ${corpus.articles[0].body.split(/\s+/).slice(8, 24).join(' ')}`), 'validation', 'bad')).toThrow('8+')
    const root = await temporary()
    vi.stubEnv('XRPL_RPC_URL', 'wss://s1.ripple.com')
    const { fundTestnetWallet } = await import('../publisher/publishing/publish.js')
    await expect(fundTestnetWallet(Wallet.generate())).rejects.toThrow('Testnet')
    const fund = vi.fn(async () => {})
    await expect(publishSite({ folder: 'examples/writer-starter', slug: '../invalid', root, fund })).rejects.toThrow('slug')
    expect(fund).not.toHaveBeenCalled()
    // An explicitly attached Testnet key is accepted without being printed.
    expect(seedEnvName('test-writer')).toBe('XRPL_PUBLISHER_TEST_WRITER_SEED')
  })
})
