// Corpus generator (#119). Live: `node --import tsx scripts/generate-corpus.mjs` (or `make corpus`).
// Flags: --only <publisherSlug> --dry-run --cap <n> --concurrency <n> --today YYYY-MM-DD --out <dir>
// Resumable: valid files on disk are skipped and the topic plan is cached in <out>/plan.json,
// so a re-run after a 429 or a crash spends nothing on finished work. Never logs keys.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ArticleSchema, articleProblems } from '../shared/contracts/writers.ts'

export const CALL_CAP = 120
const TARGETS = { notfinancialtimes: 15, 'load-factor': 10, 'basis-points': 10, 'the-fab-floor': 10, 'kopi-contrarian': 8, 'marketpulse-digest': 10, alphaleak: 8, 'open-records': 10 }
const STYLE = {
  notfinancialtimes: 'Masthead reporting: third person, inverted pyramid, named analysts and dated figures, no first person.',
  'load-factor': 'Personal blog of an energy-systems professor: first person, teacherly, shows arithmetic, cites primary data.',
  'basis-points': 'Newsletter by an ex-central-bank economist: first person, careful and hedged, separates what was said from what markets did.',
  'the-fab-floor': 'Anonymous procurement insider: blunt first person, industry shorthand, always dated figures and week counts.',
  'kopi-contrarian': 'Opinion column: punchy, sardonic, first person, strong claims, almost no hard figures or citations.',
  'marketpulse-digest': 'Rewrite desk: paraphrase the SOURCE article paragraph by paragraph in a breezy voice. Add nothing new; keep its facts and figures.',
  alphaleak: 'Hype-y tipster: breathless, vague sourcing ("people familiar"), promises big reveals, short on verifiable figures.',
  'open-records': 'Public-record desk: neutral, dated, states facts and sources only, no opinion.',
}
const RESERVED = 'Do not write about: the Kestrel Semiconductor and TSMC deal, Kestrel Penang packaging lead times, or the BoJ meeting of 17-18 September 2026. Those stories are written elsewhere.'
const day = 86400000
const iso = ms => new Date(ms).toISOString().slice(0, 10)
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export function loadInputs(root) {
  const dir = join(root, 'data/writers')
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => readJson(join(dir, f)))
  // Plan NotFT first so MarketPulse can pick stories to rewrite.
  files.sort((a, b) => (b.publisher.slug === 'notfinancialtimes') - (a.publisher.slug === 'notfinancialtimes'))
  return { roster: files, bible: readJson(join(root, 'data/corpus/v2/story-bible.json')) }
}

export async function generate({ llm, root, out, only, dryRun = false, cap = CALL_CAP, concurrency = 3, requests, today = '2026-10-07', wait = sleep, log = console.log }) {
  const { roster, bible } = loadInputs(root)
  const outDir = out ?? join(root, 'data/corpus/v2')
  const planPath = join(outDir, 'plan.json')
  const plan = existsSync(planPath) ? readJson(planPath) : {}
  const golden = bible.useCases.flatMap(u => u.articles)
  const result = { calls: 0, written: 0, skipped: 0, failed: [], planned: 0 }

  async function call(name, system, input) {
    for (let delay = 5000, tries = 0; ; tries++) {
      // `requests` (live: counted at fetch) sees streamJson's internal retries; fakes fall back to one per call.
      if ((requests ? requests() : result.calls) >= cap) throw new Error(`call cap ${cap} reached`)
      result.calls++
      try { return await llm(name, system, input) } catch (error) {
        if (!/429/.test(String(error?.message)) || tries >= 3) throw error
        log(`429 on ${name}; backing off ${delay / 1000}s`)
        await wait(delay); delay *= 3
      }
    }
  }

  const publishers = roster.filter(f => !only || f.publisher.slug === only)
  const goldenFor = slug => golden.filter(a => a.publisherSlug === slug)
  const isGolden = id => golden.some(a => a.articleId === id)

  // 1. Plan: one LLM call per publisher, cached.
  for (const f of publishers) {
    const slug = f.publisher.slug
    if (plan[slug]) continue
    const count = Math.max(0, TARGETS[slug] - goldenFor(slug).length)
    if (dryRun) { log(`[dry-run] would plan ${count} articles for ${slug} (1 call)`); result.calls++; continue }
    const mixed = 'free' in f.publisher.prices && Object.keys(f.publisher.prices).length > 1
    const sources = slug === 'marketpulse-digest' ? Object.values(plan.notfinancialtimes ?? {}).concat(goldenFor('notfinancialtimes')).map(a => ({ articleId: a.articleId, title: a.title, family: a.family })) : undefined
    const res = await call(`plan:${slug}`, `You plan blog posts for a fictional writer. Return JSON {"articles":[{"title","writerSlug","publishedAt":"YYYY-MM-DD","tags":[string],"tier":"FREE"|"PAID","family":string,"derivedFrom"?:string}]} with exactly ${count} distinct articles. ${RESERVED} Dates must be between ${iso(Date.parse(today) - 183 * day)} and ${iso(Date.parse(today) - day)}. ${mixed ? 'Make about 40% FREE and the rest PAID.' : ''} ${sources ? 'About 70% must be rewrites: set derivedFrom to an articleId from sourceArticles and reuse its family.' : 'Give each article a short kebab-case family name.'}`,
      { publisher: f.publisher.name, bio: f.publisher.bio, writers: f.writers, lanes: f.topics, count, sourceArticles: sources })
    const list = (Array.isArray(res?.articles) ? res.articles : []).slice(0, count)
    const paid = Math.max(...Object.values(f.publisher.prices))
    const ids = new Set(Object.keys(plan).flatMap(k => Object.keys(plan[k])).concat(golden.map(a => a.articleId)))
    plan[slug] = {}
    list.forEach((p, i) => {
      const title = String(p.title ?? `Untitled ${i + 1}`)
      let articleId = `${slug.split('-')[0]}-${slugify(title) || `post-${i + 1}`}`
      while (ids.has(articleId)) articleId += '-b'
      ids.add(articleId)
      const t = Date.parse(p.publishedAt)
      const ok = t >= Date.parse(today) - 183 * day && t < Date.parse(today)
      const tier = f.publisher.kind === 'records' || paid === 0 ? 'FREE' : mixed ? (p.tier === 'FREE' ? 'FREE' : 'PAID') : 'PAID'
      const src = sources?.find(s => s.articleId === p.derivedFrom)
      plan[slug][articleId] = {
        articleId, publisherSlug: slug, writerSlug: f.writers.some(w => w.slug === p.writerSlug) ? p.writerSlug : f.writers[0].slug, tier, priceMinor: tier === 'PAID' ? paid : 0,
        title, publishedAt: ok ? iso(t) : iso(Date.parse(today) - (i * 9 + 3) * day), tags: Array.isArray(p.tags) && p.tags.length ? p.tags.map(String) : [slug], family: src?.family ?? (slugify(String(p.family ?? title)) || articleId),
        ...(src ? { derivedFrom: src.articleId } : {}), facts: [], role: 'generated',
      }
      result.planned++
    })
    mkdirSync(outDir, { recursive: true }); writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n')
  }
  if (dryRun) {
    const todo = publishers.flatMap(f => [...goldenFor(f.publisher.slug), ...Object.values(plan[f.publisher.slug] ?? {})]).filter(a => !existsSync(articlePath(outDir, a)))
    log(`[dry-run] ${todo.length} articles to write; ${result.calls} planning calls; cap ${cap}. No network used.`)
    return result
  }

  // 2. Write: originals first, then rewrites (they need their source on disk).
  const publisherBySlug = new Map(roster.map(f => [f.publisher.slug, f]))
  const entries = publishers.flatMap(f => [...goldenFor(f.publisher.slug), ...Object.values(plan[f.publisher.slug] ?? {})])
  const originals = entries.filter(a => !a.derivedFrom), rewrites = entries.filter(a => a.derivedFrom)
  for (const batch of [originals, rewrites]) await pool(batch, concurrency, async entry => {
    try { await writeOne(entry) } catch (error) { result.failed.push(`${entry.articleId}: ${error.message}`); log(`FAILED ${entry.articleId}: ${error.message}`) }
  })
  log(`calls ${requests ? requests() : result.calls}/${cap}; written ${result.written}; skipped ${result.skipped}; failed ${result.failed.length}`)
  return result

  async function writeOne(entry) {
    const f = publisherBySlug.get(entry.publisherSlug), file = articlePath(outDir, entry)
    if (existsSync(file) && !validate(readJson(file), entry, f).length) { result.skipped++; return }
    let source
    if (entry.derivedFrom) {
      const sf = [...publisherBySlug.values()].map(x => articlePath(outDir, { publisherSlug: x.publisher.slug, articleId: entry.derivedFrom })).find(existsSync)
      if (!sf) throw new Error(`source ${entry.derivedFrom} not written yet`)
      source = { title: readJson(sf).title, body: readJson(sf).body }
    }
    const planted = isGolden(entry.articleId) && bible.alphaLeakPlant.articleId === entry.articleId ? bible.alphaLeakPlant.passageText : undefined
    let problems = []
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await call(`write:${entry.articleId}`, `Write a blog article as JSON {"abstract": string, "body": string}. body: markdown with 3-5 "## " subheadings and plain paragraphs separated by blank lines (no lists, tables or bold), between 700 and 1100 words, dated ${entry.publishedAt}. abstract: ONE teaser sentence under 200 characters that does not reveal the figures inside${entry.tier === 'PAID' ? ' (this article is paid)' : ''} and does not copy any 8 consecutive words from the body. Everything is fictional; real names (TSMC, BoJ) are allowed. Every string in "mustInclude" must appear verbatim in the body (keep numbers and dates exactly as written). Style: ${STYLE[entry.publisherSlug]}${planted ? ' Include the "plantedParagraph" verbatim as its own paragraph, and write no other sentence giving lead times in weeks.' : ''}`,
        { publisher: f.publisher.name, writer: f.writers.find(w => w.slug === entry.writerSlug), title: entry.title, tags: entry.tags, mustInclude: entry.facts.flatMap(x => x.needles), factStatements: entry.facts.map(x => x.text), plantedParagraph: planted, source, previousProblems: problems.length ? problems : undefined })
      let body = String(res?.body ?? '').trim()
      if (planted && !body.includes(planted)) { const parts = body.split(/\n\s*\n/); parts.splice(Math.min(3, parts.length), 0, planted); body = parts.join('\n\n') }
      const article = assemble(entry, { abstract: String(res?.abstract ?? '').trim(), body }, bible)
      problems = validate(article, entry, f)
      if (!problems.length) { mkdirSync(join(outDir, 'articles', entry.publisherSlug), { recursive: true }); writeFileSync(file, JSON.stringify(article, null, 2) + '\n'); result.written++; return }
    }
    throw new Error(problems.join('; '))
  }

  function validate(article, entry, f) {
    const parsed = ArticleSchema.safeParse(article)
    if (!parsed.success) return [parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')]
    const problems = articleProblems(parsed.data, f.publisher)
    for (const n of entry.facts.flatMap(x => x.needles)) if (!article.body.includes(n)) problems.push(`missing required text: ${n}`)
    for (const c of entry.manifestClaims ?? []) if (!article.passages.some(p => p.id === c.passageId)) problems.push(`no passage ${c.passageId} for claim ${c.id}`)
    if (bible.alphaLeakPlant.articleId === entry.articleId && /\d+\s*weeks/i.test(article.body)) problems.push('planted article must not state lead times in weeks')
    return problems
  }
}

const articlePath = (outDir, a) => join(outDir, 'articles', a.publisherSlug, `${a.articleId}.json`)

/** One passage per paragraph; claim passages get the id the manifest claim names. */
export function assemble(entry, { abstract, body }, bible) {
  let heading, n = 0
  const passages = []
  for (const block of body.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)) {
    if (block.startsWith('#')) { heading = block.replace(/^#+\s*/, ''); continue }
    passages.push({ id: `p${++n}`, ...(heading ? { heading } : {}), text: block })
  }
  const plant = bible.alphaLeakPlant.articleId === entry.articleId ? bible.alphaLeakPlant : undefined
  for (const c of entry.manifestClaims ?? []) {
    const first = entry.facts[0]?.needles ?? []
    const hit = passages.find(p => (plant ? p.text === plant.passageText : first.every(x => p.text.includes(x))) && !passages.some(q => q.id === c.passageId))
    if (hit) hit.id = c.passageId
  }
  return {
    articleId: entry.articleId, version: 'v1', publisherSlug: entry.publisherSlug, writerSlug: entry.writerSlug, title: entry.title, publishedAt: entry.publishedAt,
    tier: entry.tier, priceMinor: entry.priceMinor, abstract: abstract.slice(0, 220), tags: entry.tags, family: entry.family, ...(entry.derivedFrom ? { derivedFrom: entry.derivedFrom } : {}), body, passages,
  }
}

async function pool(items, size, fn) {
  const queue = [...items]
  await Promise.all(Array.from({ length: size }, async () => { for (let x = queue.shift(); x; x = queue.shift()) await fn(x) }))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2)
  const flag = name => { const i = argv.indexOf(`--${name}`); return i < 0 ? undefined : argv[i + 1] }
  const dryRun = argv.includes('--dry-run')
  const cap = Number(argv[argv.indexOf('--cap') + 1] || CALL_CAP) || CALL_CAP
  let sent = 0
  await import('dotenv/config')
  process.env.LLM_PROVIDER ??= 'deepseek'
  let llm = async () => { throw new Error('no network in dry-run') }
  if (!dryRun) {
    const { streamJson, isLlmConfigured } = await import('../server/agents/llm.ts')
    if (!isLlmConfigured()) { console.error('DEEPSEEK_API_KEY is not set (LLM_PROVIDER=deepseek).'); process.exit(2) }
    llm = (name, system, input) => streamJson(system, input, undefined, name)
    // Count real provider requests: streamJson may retry internally, and the cap is on requests.
    const realFetch = globalThis.fetch
    globalThis.fetch = (...args) => {
      if (String(args[0]).includes('/chat/completions')) {
        if (sent >= cap) return Promise.reject(new Error(`request cap ${cap} reached`))
        sent++
      }
      return realFetch(...args)
    }
  }
  const root = new URL('..', import.meta.url).pathname
  const r = await generate({ llm, root, out: flag('out'), only: flag('only'), dryRun, cap, requests: dryRun ? undefined : () => sent, concurrency: Number(flag('concurrency') ?? 3), today: flag('today') })
  process.exit(r.failed.length ? 1 : 0)
}
