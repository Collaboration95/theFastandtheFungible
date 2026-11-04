import { issueWriterCredential } from './credential.js'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Client, Wallet } from 'xrpl'
import { parse } from 'dotenv'
import { createPublisherApp } from '../routes.js'
import { localWriterRoot } from '../local-writers.js'
import { publisherKeys, seedEnvName } from '../registry.js'
import { markdownCorpus } from './markdown.js'
import { payeeRefusal } from '../../server/payee-screening.js'
import { testnetUrl } from '../../shared/xrpl.js'
import type { Rail } from '../../shared/contracts/publisher.js'
import { buildIndex, cachedVector, EMBEDDING_DIMS, EMBEDDING_MODEL, embedTexts, embeddingKey, embeddingText, embeddingsLive, type EmbeddingCache } from '../search.js'
import { sha256 } from '../../shared/manifest.js'

/** Faucet provisioning never signs a payment. The fixed Testnet allowlist is checked before connecting. */
export async function fundTestnetWallet(wallet: Wallet): Promise<void> {
  const client = new Client(testnetUrl(), { connectionTimeout: 8000, timeout: 12000 })
  try {
    await client.connect()
    try {
      await client.request({ command: 'account_info', account: wallet.classicAddress, ledger_index: 'validated' })
      return // Receiving requires no balance top-up for an existing account.
    } catch (error) { if ((error as { data?: { error?: string } }).data?.error !== 'actNotFound') throw error }
    await client.fundWallet(wallet)
  } catch { throw new Error('Testnet wallet funding failed. The key is saved; rerun the same command to retry. Check XRPL_RPC_URL and Testnet faucet availability.') }
  finally { await client.disconnect() }
}

export type PublishOptions = {
  folder: string; slug: string; name?: string; rail?: Rail; port?: number; root?: string
  credential?: typeof issueWriterCredential; env?: NodeJS.ProcessEnv; fund?: (wallet: Wallet) => Promise<void>; log?: (line: string) => void
}
export async function publishSite(options: PublishOptions) {
  const started = performance.now()
  const log = options.log ?? console.log
  const env = options.env ?? process.env
  const rail = options.rail ?? 'xrpl-testnet'
  const root = resolve(options.root ?? localWriterRoot())
  const corpus = await markdownCorpus(resolve(options.folder), options.slug, options.name ?? options.slug)
  // Refuse an installed roster collision before creating or funding a wallet.
  if (existsSync(new URL(`../../data/writers/${options.slug}.json`, import.meta.url))) throw new Error('Writer slug already belongs to the built-in roster; choose --slug')
  const dir = join(root, options.slug)
  await mkdir(root, { recursive: true, mode: 0o700 })
  const lock = join(root, `.${options.slug}.lock`)
  try { await mkdir(lock) } catch { throw new Error('This writer is already being published; wait for the other command to finish') }
  let app: ReturnType<typeof createPublisherApp> | undefined
  try {
    await mkdir(dir, { recursive: true, mode: 0o700 })
    await chmod(dir, 0o700)
    const keyFile = join(dir, '.env.writer')
    const saved = existsSync(keyFile) ? parse(await readFile(keyFile)) : {}
    const variable = seedEnvName(options.slug)
    let wallet: Wallet | undefined
    let credential: Awaited<ReturnType<typeof issueWriterCredential>> | undefined
    if (rail === 'xrpl-testnet') {
      if (saved[variable] && env[variable] && saved[variable] !== env[variable]) throw new Error('Saved writer key differs from the environment; refusing to replace the wallet')
      try { wallet = saved[variable] || env[variable] ? Wallet.fromSeed(saved[variable] || env[variable]!) : Wallet.generate() }
      catch { throw new Error(`Invalid writer key in ${variable}; use a Testnet wallet seed in the environment, never a command argument`) }
      // This also refuses the public deterministic fixture key on the Testnet rail.
      publisherKeys(options.slug, rail, { [variable]: wallet.seed })
      const refusal = payeeRefusal(wallet.classicAddress)
      if (refusal) throw new Error(refusal)
      // Persist first, and never overwrite an existing key (including on funding failure).
      if (!existsSync(keyFile)) await writeFile(keyFile, `${variable}=${wallet.seed}\n`, { flag: 'wx', mode: 0o600 })
      await chmod(keyFile, 0o600)
      log(`Wallet ${wallet.classicAddress} · XRPL TESTNET · key saved privately`)
      await (options.fund ?? fundTestnetWallet)(wallet)
      credential = await (options.credential ?? issueWriterCredential)(wallet, root)
    } else log('SIMULATED wallet and payments · no Testnet transaction')
    let embeddings: EmbeddingCache | undefined
    const cacheFile = join(dir, 'embeddings.json')
    if (embeddingsLive(env)) {
      embeddings = existsSync(cacheFile) ? JSON.parse(await readFile(cacheFile, 'utf8')) as EmbeddingCache : { model: EMBEDDING_MODEL, dims: EMBEDDING_DIMS, vectors: {} }
      const missing = corpus.articles.filter(a => !cachedVector(embeddings, a))
      if (missing.length) {
        const vectors = await embedTexts(missing.map(embeddingText))
        missing.forEach((a, i) => { embeddings!.vectors[embeddingKey(a)] = { hash: sha256(embeddingText(a)), vector: vectors[i] } })
        await writeFile(cacheFile, JSON.stringify(embeddings), { mode: 0o600 })
      }
    }
    // Check indexability before registering; startup builds the same index with the same cache.
    await buildIndex(corpus.articles, embeddings)
    app = createPublisherApp({ writers: corpus, rail, env: { ...env, ESCROW_MODE: rail === 'xrpl-testnet' ? 'key-reveal' : env.ESCROW_MODE, ESCROW_WRITERS: options.slug, ...saved, ...(wallet ? { [variable]: wallet.seed } : {}) },
      journal: join(dir, 'publisher.db'), embeddings })
    await app.locals.ready
    const server = app.listen(options.port ?? 8790 + Number(env.OFFSET || 0), '127.0.0.1')
    try { await once(server, 'listening') }
    catch { throw new Error('Publisher port is unavailable; choose --port or OFFSET=800') }
    const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    server.once('close', () => { app!.locals.journal.close(); void app!.locals.ledger?.close?.() })
    try {
      await writeFile(join(dir, 'corpus.json.tmp'), JSON.stringify(corpus), { mode: 0o600 })
      await rename(join(dir, 'corpus.json.tmp'), join(dir, 'corpus.json'))
      if (embeddings) {
        // The cache stays alongside private content; loadWriterCorpus merges it at next startup.
        log('Search: hybrid · Workers AI embeddings')
      } else log('Search: keyword · live embeddings off (SEARCH_EMBEDDINGS=live enables hybrid)')
      log('Metadata: deterministic · headings/front matter → signed fact menu · no LLM calls')
      const seconds = (performance.now() - started) / 1000
      if (credential && wallet) {
        log(`Writer live · address ${wallet.classicAddress} · CredentialCreate tx https://testnet.xrpl.org/transactions/${credential.hash} ↗ · first sale will appear as EscrowFinish`)
        log(`WRITER_CREDENTIAL_ISSUERS=${JSON.stringify([credential.trust])}`)
      }
      log(`Published ${corpus.articles.length} articles · ${credential ? "Testnet credential issued" : "unverified writer"} · ${corpus.publishers[0].synthetic ? 'SYNTHETIC' : 'AUTHOR SUPPLIED'}`)
      log(`Site ${baseUrl}/w/${options.slug}/`)
      log(`Registry ${baseUrl}/registry · registered locally for the next engine start`)
      log(`UI/MCP: PUBLISHER_URL=${baseUrl} (keep this command running)`)
      log(`Folder → searchable, payable writer: ${seconds.toFixed(2)} s${seconds >= 60 ? ' · over the 60 s target' : ''}`)
      return { server, app, corpus, baseUrl, seconds, dir }
    } catch (error) { server.close(); server.closeAllConnections(); throw error }
  } catch (error) {
    app?.locals.journal.close()
    void app?.locals.ledger?.close?.()
    throw error
  } finally { await rm(lock, { recursive: true, force: true }) }
}
