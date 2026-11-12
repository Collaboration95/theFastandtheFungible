// Durable moderation lives beside the publisher, never in a browser or a model tool.
import { Router, json } from 'express'
import { validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { chmodSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Wallet, isValidClassicAddress } from 'xrpl'
import { z } from 'zod'
import { AuditLog } from '../../server/audit.js'
import { payeeRefusal } from '../../server/payee-screening.js'
import { BUDGET } from '../../shared/contracts/run.js'
import { validateWriterCorpus, type WriterCorpus } from '../../shared/contracts/writers.js'
import { parseMarkdown } from './markdown.js'
import { fundTestnetWallet } from './testnet-funding.js'
import { buildRegistry, type PublisherEntry } from '../registry.js'

export const NoteInput = z.object({ title: z.string().trim().min(3).max(100), body: z.string().trim().min(1).max(24000),
  priceMinor: z.number().int().min(1).max(BUDGET.capMinor), topics: z.array(z.string().trim().min(1).max(60)).min(1).max(8),
  displayName: z.string().trim().min(1).max(60).optional(), payout: z.union([z.literal('create'), z.string().refine(isValidClassicAddress)]) }).strict()
export type NoteInput = z.infer<typeof NoteInput>
const digest = (s: string) => createHash('sha256').update(s).digest('hex')
const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const recoveryWords = new Set(wordlist), recoveryLengths = [12,15,18,21,24]
export function precheck(note: NoteInput) {
  const all = [note.title, note.body, ...note.topics, note.displayName ?? ''].join('\n')
  if (/sEd[1-9A-HJ-NP-Za-km-z]{20,}|\bs[1-9A-HJ-NP-Za-km-z]{25,33}\b|(?:api[_ -]?key|secret|password|seed|private[_ -]?key)\s*[:=]|-----BEGIN .*PRIVATE KEY|\b(?:sk|ra_agent)[-_][A-Za-z0-9_-]{16,}|\b[a-fA-F0-9]{64}\b|\bBearer\s+\S+/i.test(all)) throw Error('Remove secrets, keys and seed phrases before submitting.')
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:\+\d[\d ()-]{7,}\d)|\b[STFGM]\d{7}[A-Z]\b|\b\d{3}-\d{2}-\d{4}\b|\b(?:\d[ -]?){13,19}\b/i.test(all)) throw Error('Remove personal contact details and identity or payment numbers.')
  const words = normalize(note.body).split(' ')
  if ((all.match(/https?:\/\//gi) ?? []).length > 3 || /<\/?(?:script|iframe)|javascript:|buy now|casino|guaranteed profit/i.test(all) || new Set(words).size / words.length < 0.22 || /(.)\1{12,}/.test(all)) throw Error('Remove spam, repeated text or excessive links (at most three).')
  // Scan only dictionary runs; a valid recovery phrase can be embedded in otherwise ordinary prose.
  for (const segment of all.toLowerCase().match(/[a-z]+(?:\s+[a-z]+)*/g) ?? []) {
    let run: string[] = []
    for (const word of segment.split(/\s+/)) {
      if (!recoveryWords.has(word)) { run=[]; continue }
      run.push(word); if (run.length>24) run.shift()
      if (recoveryLengths.some(n=>run.length>=n && validateMnemonic(run.slice(-n).join(' '),wordlist))) throw Error('Remove secrets, keys and seed phrases before submitting.')
    }
  }
}
export function noteCorpus(note: NoteInput, slug: string, publishedAt: string): WriterCorpus {
  // JSON quoting stays inside the deliberately scalar front matter; newlines cannot inject fields.
  const scalar = (s: string) => s.replace(/[\r\n]/g, ' ').replace(/["']/g, '')
  const text = `---\ntitle: ${scalar(note.title)}\nabstract: Paid note covering ${note.topics.map(scalar).join(', ')}.\ntier: PAID\nprice: ${(note.priceMinor / 100).toFixed(2)}\ntags: ${note.topics.map(scalar).join(', ')}\nsynthetic: false\n---\n${note.body}`
  const article = parseMarkdown(text, slug, 'note', publishedAt, { validateBody: true })
  const name = note.displayName ?? 'Writer'
  return validateWriterCorpus({ publishers: [{ slug, name, kind: 'independent', domain: 'community', prices: { [article.articleId]: article.priceMinor }, licence: 'Author supplied; attribution required', accent: '#64748b', heroQuote: 'Expertise for agents', bio: name, synthetic: false, verification: 'unverified writer' }], writers: [{ slug, publisherSlug: slug, name, bio: name, voice: 'Author supplied' }], articles: [article] }, { realWriter: true })
}
type Row = { id: string; key_hash: string; fingerprint: string; json: string; state: string; created: number; live: number | null; seed: string | null; address: string | null; error: string | null }
export function webPublishing(options: { env: NodeJS.ProcessEnv; file: string; install: (entry: PublisherEntry) => void; fund?: typeof fundTestnetWallet }) {
  const router = Router(), env = options.env
  if (env.WEB_PUBLISHING !== 'on') return { router, ready: Promise.resolve(), close: async () => {} }
  if (!env.OPERATOR_TOKEN || env.OPERATOR_TOKEN.length < 24) throw Error('WEB_PUBLISHING requires OPERATOR_TOKEN (at least 24 characters)')
  if (env.SETTLEMENT_RAIL !== 'xrpl-testnet') throw Error('WEB_PUBLISHING requires the XRPL Testnet rail')
  mkdirSync(dirname(options.file), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(options.file); chmodSync(options.file, 0o600)
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS web_notes(id TEXT PRIMARY KEY,key_hash TEXT NOT NULL,fingerprint TEXT UNIQUE NOT NULL,json TEXT NOT NULL,state TEXT NOT NULL,created INTEGER NOT NULL,live INTEGER,seed TEXT,address TEXT,error TEXT); CREATE TABLE IF NOT EXISTS web_limits(bucket TEXT PRIMARY KEY,n INTEGER NOT NULL);`)
  for (const suffix of ['-wal','-shm']) { try { chmodSync(options.file + suffix, 0o600) } catch { /* not created yet */ } }
  AuditLog.ensureSchema(db); const audit = new AuditLog(db)
  db.exec("UPDATE web_notes SET state='pending' WHERE state='publishing'")
  const row = (id: string) => db.prepare('SELECT * FROM web_notes WHERE id=?').get(id) as Row | undefined
  const publicRow = (r: Row) => ({ id: r.id, state: r.state, createdAt: r.created, liveAt: r.live, secondsToLive: r.live ? (r.live-r.created)/1000 : undefined, address: r.address, slug: `community-${r.id}`, articleId: `community-${r.id}-note`, error: r.error })
  const refuse = (reason: string, id?: string) => audit.append({ kind: 'refusal', surface: 'publishing', data: { reason, ...(id ? { noteId: id } : {}) } })
  const operator = (actual?: string) => { const a = Buffer.from(actual ?? ''), b = Buffer.from(env.OPERATOR_TOKEN!); return a.length === b.length && timingSafeEqual(a,b) }
  let busy = false, closed = false
  const approve = async (id: string) => {
    const r = row(id)
    if (!r || !['pending','failed'].includes(r.state)) return
    if (busy) return
    busy = true
    db.prepare("UPDATE web_notes SET state='publishing',error=NULL WHERE id=?").run(id)
    try {
      const note = NoteInput.parse(JSON.parse(r.json)); precheck(note)
      const corpus = noteCorpus(note, `community-${id}`, new Date(r.created).toISOString())
      // For pasted addresses a matching operator-held key is mandatory. Never ask a browser for a seed.
      let wallet: Wallet
      if (r.seed) wallet = Wallet.fromSeed(r.seed)
      else if (note.payout === 'create') wallet = Wallet.generate()
      else {
        const seed = Object.entries(env).filter(([name]) => /^XRPL_PUBLISHER_.*_SEED$/.test(name)).map(([,s]) => s).find(s => { try { return !!s && Wallet.fromSeed(s).classicAddress === note.payout } catch { return false } })
        if (!seed) throw Error('This payout address needs its matching signing key configured privately by the operator. Choose create an account to publish now.')
        wallet = Wallet.fromSeed(seed)
      }
      db.prepare('UPDATE web_notes SET seed=?,address=? WHERE id=?').run(wallet.seed!,wallet.classicAddress,id)
      const refusal = payeeRefusal(wallet.classicAddress); if (refusal) throw Error(refusal)
      await (options.fund ?? fundTestnetWallet)(wallet)
      const slug = corpus.publishers[0].slug
      const built = await buildRegistry(corpus, { rail: 'xrpl-testnet', env: { ...env, [`XRPL_PUBLISHER_${slug.toUpperCase().replace(/-/g,'_')}_SEED`]: wallet.seed } })
      options.install(built.get(slug)!)
      db.prepare("UPDATE web_notes SET state='live',live=?,error=NULL WHERE id=?").run(Date.now(),id)
      audit.append({ kind:'publish', surface:'publishing', data:{ noteId:id, address:wallet.classicAddress } })
    } catch (error) {
      // Only validation errors that we authored can reach the UI. Network/library errors may contain secrets.
      const message = error instanceof Error && /^(This payout address|Payee is|Operator payee)/.test(error.message) ? error.message : 'Publishing failed. The account is saved privately; ask the operator to retry.'
      db.prepare("UPDATE web_notes SET state='failed',error=? WHERE id=?").run(message,id); refuse('publish_failed',id)
    } finally { busy = false }
  }
  const ready = (async () => { for (const r of db.prepare("SELECT * FROM web_notes WHERE state='live'").all() as Row[]) {
    const corpus = noteCorpus(NoteInput.parse(JSON.parse(r.json)), `community-${r.id}`, new Date(r.created).toISOString()), slug = corpus.publishers[0].slug
    const built = await buildRegistry(corpus, { rail:'xrpl-testnet', env:{ ...env, [`XRPL_PUBLISHER_${slug.toUpperCase().replace(/-/g,'_')}_SEED`]:r.seed! } }); options.install(built.get(slug)!)
  } })()
  router.use('/api/publishing', json({ limit:'32kb' }), async (_req,_res,next) => { await ready; next() })
  router.get('/api/publishing/config', (_req,res) => res.json({ enabled:true, minPriceMinor:1, maxPriceMinor:BUDGET.capMinor, autoApprove:env.AUTO_APPROVE === 'on', autoApproveSeconds:Number(env.AUTO_APPROVE_SECONDS ?? 5) }))
  router.post('/api/publishing/notes', (req,res) => {
    const bucket = String(Math.floor(Date.now()/60000))
    db.prepare('DELETE FROM web_limits WHERE bucket<>?').run(bucket)
    const n = Number(db.prepare('SELECT n FROM web_limits WHERE bucket=?').get(bucket)?.n ?? 0)
    if (n >= 10 || Number(db.prepare('SELECT COUNT(*) AS n FROM web_notes').get()!.n) >= 1000) { refuse('queue_limit'); return res.status(429).json({ error:'Publishing is busy. Try again shortly.' }) }
    db.prepare('INSERT INTO web_limits VALUES (?,1) ON CONFLICT(bucket) DO UPDATE SET n=n+1').run(bucket)
    const parsed = NoteInput.safeParse(req.body)
    if (!parsed.success) { refuse('invalid_fields'); return res.status(400).json({ error:'Check title, body, topics, price and payout address.' }) }
    const note = parsed.data
    try { precheck(note); noteCorpus(note,'community-check',new Date().toISOString()) }
    catch (e) { refuse('precheck'); return res.status(400).json({ error:e instanceof Error ? e.message.slice(0,600) : 'Pre-check failed.' }) }
    const fingerprint = digest(normalize(note.body)), id = randomUUID().replaceAll('-',''), key = randomBytes(32).toString('hex')
    if (db.prepare('SELECT 1 FROM web_notes WHERE fingerprint=?').get(fingerprint)) { refuse('duplicate'); return res.status(409).json({ error:'This note has already been submitted.' }) }
    db.prepare("INSERT INTO web_notes VALUES (?,?,?,?,'pending',?,NULL,NULL,NULL,NULL)").run(id,digest(key),fingerprint,JSON.stringify(note),Date.now())
    audit.append({kind:'moderation',surface:'publishing',data:{noteId:id,state:'pending'}})
    res.status(202).json({ ...publicRow(row(id)!), key })
  })
  router.get('/api/publishing/notes/:id', (req,res) => {
    const r = row(req.params.id)
    if (!r || digest(req.get('X-Publishing-Key') ?? '') !== r.key_hash) return res.status(404).json({ error:'Note not found.' })
    res.json(publicRow(r))
  })
  router.use('/api/publishing/operator', (req,res,next) => { if (!operator(req.get('X-Operator-Token'))) { refuse('operator_unauthorized'); res.status(401).json({error:'Operator access required.'}); return }; next() })
  router.get('/api/publishing/operator/queue', (_req,res) => res.json({ notes: (db.prepare("SELECT * FROM web_notes WHERE state IN ('pending','failed','publishing') ORDER BY created LIMIT 100").all() as Row[]).map(r => ({ ...publicRow(r), note:JSON.parse(r.json) })) }))
  router.post('/api/publishing/operator/:id/:action', async (req,res) => {
    const r = row(req.params.id)
    if (!r) return res.sendStatus(404)
    if (req.params.action === 'reject' && ['pending','failed'].includes(r.state)) { db.prepare("UPDATE web_notes SET state='rejected' WHERE id=?").run(r.id); refuse('operator_rejected',r.id) }
    else if (req.params.action === 'approve') { if (busy) return res.status(409).json({error:'Another note is publishing. Retry shortly.'}); await approve(r.id) }
    else return res.sendStatus(400)
    res.json(publicRow(row(r.id)!))
  })
  let job: Promise<void> | undefined
  const timer = setInterval(() => {
    if (closed || busy || env.AUTO_APPROVE !== 'on' || job) return
    const r = db.prepare("SELECT id FROM web_notes WHERE state='pending' AND created<=? ORDER BY created LIMIT 1").get(Date.now()-Number(env.AUTO_APPROVE_SECONDS ?? 5)*1000)
    if (r) job = ready.then(() => approve(String(r.id))).finally(() => {job=undefined})
  },250); timer.unref()
  return { router, ready, close: async () => { closed=true; clearInterval(timer); try { await ready; await job; while (busy) await new Promise(r=>setTimeout(r,25)) } finally { db.close() } } }
}
export const webQueueFile = (journal: string) => join(dirname(journal), 'web-publishing.db')
