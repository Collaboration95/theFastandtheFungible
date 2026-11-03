import { mkdtempSync, rmSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { startEngine } from '../server/engine.js'
import { createClient } from '../sdk/index.js'
import { fixtureSupports, fixtureCoverage } from '../server/agents/requirements.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { buildIndex, searchIndex } from '../publisher/search.js'

it('calibrates keyword floor across corpus titles, near misses and off-corpus topics', async () => {
  const corpus = await loadWriterCorpus()
  const index = await buildIndex(corpus.articles)
  for (const a of corpus.articles) expect((await searchIndex(index, a.title, corpus.articles.length)).ranked.map(r => r.articleId)).toContain(a.articleId)
  for (const q of ['What is the RLUSD trust line requirement?', 'How do Kubernetes pods schedule?', 'How does CRISPR gene editing work?', 'What are sourdough starter feeding ratios?']) expect((await searchIndex(index, q, 10)).ranked, q).toEqual([])
  for (const q of ['Kestrel-TSMC margins', 'Kestrel–TSMC margins', '“Kestrel”—TSMC pricing', "Kestrel’s TSMC wafer agreement", 'BoJ yields', 'Penang electricity']) expect((await searchIndex(index, q, 5)).ranked.length, q).toBeGreaterThan(0)
})
it('coverage handles price/pricing and margin/margins without accepting an absent measure', () => {
  const text = 'Kestrel and TSMC agreed a wafer price of $22,500; gross margin estimates fell to 55.2%.'
  expect(fixtureSupports({text:'How does Kestrel benefit from the TSMC deal (pricing & margins)?'}, text)).toBe(true)
  expect(fixtureSupports({text:'What is the Kestrel dividend payout ratio?'}, text)).toBe(false)
  const req = [{id:'r1', text:'How does Kestrel benefit from the TSMC deal (pricing & margins)?'}]
  const evidence = [{ref:'price',text:'Kestrel and TSMC agreed a price of $22,500 per wafer.'}, {ref:'margin',text:'Kestrel and TSMC gross margin estimates fell to 55.2%.'}]
  expect(fixtureCoverage(req, evidence)).toEqual({r1:'supported'})
  expect(fixtureCoverage(req, evidence.slice(0,1))).toEqual({r1:'missing'})
  expect(fixtureCoverage(req, [{ref:'free',text:'Kestrel and TSMC announced a 2027 deal, with no pricing or margin guidance.'}])).toEqual({r1:'missing'})
})
it('first run buys, cites paid contribution, reports coverage, and abstains without purchases', async () => {
  vi.stubEnv('MCP_MAX_BUDGET_MINOR','200'); vi.stubEnv('MCP_DAILY_CAP_MINOR','500')
  const dir = mkdtempSync('/tmp/first-run-')
  const engine = await startEngine({dataDir: dir})
  try {
    const client = createClient({baseUrl:engine.apiUrl, token:engine.apiToken})
    const task = client.ask('What is the analyst outlook on the Kestrel Semiconductor deal with TSMC (pricing & margins)?', {budget:1})
    const events = []; for await (const e of task.events) events.push(e)
    const run = await task
    expect(run.receipts).toHaveLength(1)
    expect(run.contributions.purchases[0].structuralUse).toBe('cited')
    expect(events.filter(e=>e.type==='COVERAGE').at(-1)?.label).toBe('2 of 2 requested facts answered.')
    for (const dash of ['-', '–', '—']) {
      const r = await client.ask(`How did the Kestrel${dash}TSMC deal change margins?`, {budget:0})
      expect(r.citations.length).toBeGreaterThan(0)
      expect(r.answer?.conclusion).toContain('Kestrel')
    }
    const r = await client.ask('What is the RLUSD trust line requirement?', {budget:1})
    expect(r.citations).toEqual([]); expect(r.receipts).toEqual([]); expect(r.spentMinor).toBe(0)
    expect(r.answer?.conclusion).toBe('No listed writer covers this; nothing bought')
  } finally { await engine.close(); rmSync(dir, {recursive:true, force:true}); vi.unstubAllEnvs() }
}, 30000)
