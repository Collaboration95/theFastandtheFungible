import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exampleRun } from '../shared/contracts/examples.js'
import { ReportSchema } from '../shared/contracts/report.js'
import type { RunSnapshot } from '../shared/contracts/index.js'

vi.mock('../server/agents/llm.js', () => ({ isLlmConfigured: vi.fn(() => false), llmProvider: () => 'groq', llmLabel: () => 'Groq', researchModel: () => 'test-groq', streamJson: vi.fn() }))
vi.mock('@playwright/test', () => ({ chromium: { launch: vi.fn() } }))
import { chromium } from '@playwright/test'
import { isLlmConfigured, streamJson } from '../server/agents/llm.js'
import { buildReport, renderReport } from '../server/agents/report.js'
import { reportHtml } from '../server/report-template.js'

let directory: string
const run = () => structuredClone(exampleRun)
const paidRun = (): RunSnapshot => {
  const snapshot = run()
  snapshot.candidates[0].tier = 'PAID'
  snapshot.grants.push({ runId: snapshot.runId, resourceId: snapshot.contents[0].resourceId, version: 'v1', intentId: 'paid-intent', contentDigest: 'verified-digest', grantedAt: '2026-10-04' })
  snapshot.intents.push({ intentId: 'paid-intent', runId: snapshot.runId, profileId: snapshot.contents[0].profileId, resourceId: snapshot.contents[0].resourceId, version: 'v1', amountMinor: 80, status: 'VERIFIED' })
  return snapshot
}
beforeEach(async () => { vi.clearAllMocks(); vi.mocked(isLlmConfigured).mockReturnValue(false); directory = await mkdtemp(join(tmpdir(), 'report-test-')) })
afterEach(async () => { await rm(directory, { recursive: true, force: true }) })

describe('report evidence and drafting', () => {
  it('builds a schema-valid labelled fixture from examples without a provider call', async () => {
    const report = await buildReport(run())
    expect(ReportSchema.parse(report).findings).toEqual(exampleRun.answers[0].claims)
    expect(report.provider).toBe('fixture')
    expect(report.disclaimer).toContain('SIMULATED SGD · no real funds')
    expect(report.sources).toEqual(exampleRun.contents)
    expect(streamJson).not.toHaveBeenCalled()
  })
  it.each(['missing', 'run', 'version', 'resource'] as const)('rejects %s paid grant before the LLM receives evidence', async mismatch => {
    const snapshot = paidRun()
    if (mismatch === 'missing') snapshot.grants = []
    if (mismatch === 'run') snapshot.grants[0].runId = 'other-run'
    if (mismatch === 'version') snapshot.grants[0].version = 'v2'
    if (mismatch === 'resource') snapshot.grants[0].resourceId = 'other-source'
    vi.mocked(isLlmConfigured).mockReturnValue(true)
    await expect(buildReport(snapshot)).rejects.toThrow('matching delivery grant')
    expect(streamJson).not.toHaveBeenCalled()
  })
  it('#142: citations open the writer article (FREE at its #p- anchor, PAID at its page); receipts list refunds', async () => {
    const snapshot = run()
    snapshot.candidates[0] = { ...snapshot.candidates[0], publisherSlug: 'open-records' }
    const leak = { ...snapshot.candidates[0], resourceId: 'alphaleak-kestrel-penang-lead-times', tier: 'PAID' as const, publisherSlug: 'alphaleak', url: '/w/alphaleak/blog/alphaleak-kestrel-penang-lead-times' }
    snapshot.candidates.push(leak)
    snapshot.intents.push({ intentId: 'leak', runId: snapshot.runId, profileId: 'alphaleak', resourceId: leak.resourceId, version: leak.version, amountMinor: 30, status: 'REFUNDED', refund: { txHash: 'AB'.repeat(32), amountMinor: 30 } })
    const report = await buildReport(snapshot)
    expect(report.refunds).toEqual([{ intentId: 'leak', resourceId: leak.resourceId, version: leak.version, amountMinor: 30, txHash: 'AB'.repeat(32) }])
    const html = reportHtml(report)
    const ref = exampleRun.answers[0].claims[0].citations[0]
    expect(html).toContain(`href="/w/open-records/blog/${ref.resourceId}#p-${ref.spanId}"`)
    expect(html).toContain('REFUND · failed proof')
    expect(html).toContain('refunded S$0.30')
    // The refunded (quarantined) source is never a cited source.
    expect(report.sources.map(s => s.resourceId)).not.toContain(leak.resourceId)
  })
  it('#142: a PAID citation opens the writer blog page, never the x402 agent endpoint', async () => {
    const snapshot = paidRun()
    snapshot.candidates[0] = { ...snapshot.candidates[0], publisherSlug: 'notfinancialtimes', url: '/w/notfinancialtimes/articles/x402-endpoint' }
    const html = reportHtml(await buildReport(snapshot))
    expect(html).toContain(`href="/w/notfinancialtimes/blog/${snapshot.contents[0].resourceId}"`)
    expect(html).not.toContain('x402-endpoint')
  })
  it('gate-4: a quarantined (failed-proof) grant is no source access for the report', async () => {
    const snapshot = paidRun(); snapshot.intents[0].status = 'CLAIM_FAILED'
    await expect(buildReport(snapshot)).rejects.toThrow('Report source requires a matching delivery grant')
  })
  it('rejects unknown, duplicate sources and non-substring passages', async () => {
    const unknown = run(); unknown.candidates = []
    await expect(buildReport(unknown)).rejects.toThrow('unknown')
    const duplicate = run(); duplicate.contents.push(duplicate.contents[0])
    await expect(buildReport(duplicate)).rejects.toThrow('ambiguous')
    const bad = run(); bad.contents[0].spans[0].text = 'invented excerpt'
    await expect(buildReport(bad)).rejects.toThrow('exact passages')
  })
  it('drops invalid claims without repairing citations and ignores LLM ledger additions', async () => {
    vi.mocked(isLlmConfigured).mockReturnValue(true)
    const good = structuredClone(exampleRun.answers[0].claims[0])
    const bad = { ...good, id: 'bad', citations: [{ ...good.citations[0], spanId: 'invented' }] }
    vi.mocked(streamJson).mockResolvedValue({ findings: [good, bad], decisions: ['fake'], receipts: ['fake'], sources: ['fake'] })
    const report = await buildReport(paidRun())
    expect(report.provider).toBe('groq')
    expect(report.findings).toEqual([good])
    expect(report.decisions).toEqual([])
    expect(report.receipts).toEqual([])
    expect(report.sources).toEqual(exampleRun.contents)
  })
  it('copies persisted decision and receipt records with source receipt references', async () => {
    const snapshot = paidRun()
    snapshot.spentMinor = 80
    snapshot.receipts.push({ receiptId: 'receipt-1', intentId: 'paid-intent', runId: snapshot.runId, resourceId: snapshot.contents[0].resourceId, version: 'v1', amountMinor: 80, currency: 'SGD', settledAt: '2026-10-04T13:00:00Z', label: 'SIMULATED SGD · no real funds' })
    snapshot.decisions.push({ round: 1, gap: 'Grid timing', gapMaterial: 0.8, provider: 'fixture', model: 'metadata-fixture', threshold: 0.2, rows: [{ candidate: snapshot.candidates[0], judgment: { addressesGap: 0.8, originality: { original: 1, rewrite: 0, overlap: 0 }, credibility: 2 }, value: 0.64, valuePerDollar: 0.8, verdict: 'BUY', reason: 'clears threshold', wouldBuy: false }] })
    const report = await buildReport(snapshot)
    expect(report.decisions).toEqual(snapshot.decisions)
    expect(report.receipts).toEqual(snapshot.receipts)
    const html = reportHtml(report)
    expect(html).toContain('Receipt IDs: receipt-1')
    expect(html).toContain('bought / granted')
    expect(html).toContain('0.800 / 1.000 / 2.000')
    expect(html).toContain('S$0.80')
  })
  it('labels stub/provider failure and all-invalid drafts as fixture', async () => {
    vi.mocked(isLlmConfigured).mockReturnValue(true)
    vi.mocked(streamJson).mockRejectedValueOnce(new Error('TODO(W1-RESEARCH)'))
    expect((await buildReport(run())).fallbackReason).toContain('failed')
    vi.mocked(streamJson).mockResolvedValue({ findings: [{ ...exampleRun.answers[0].claims[0], citations: [{ resourceId: 'missing', version: 'v1', spanId: 'x' }] }] })
    const report = await buildReport(run())
    expect(report.provider).toBe('fixture')
    expect(report.findings).toEqual(exampleRun.answers[0].claims)
  })
  it('drops invalid final-answer references from fallback and displays cited version changes', async () => {
    const snapshot = run()
    snapshot.answers.push({ ...structuredClone(snapshot.answers[0]), version: 2, claims: [{ ...snapshot.answers[0].claims[0], text: 'Revised finding' }, { ...snapshot.answers[0].claims[0], id: 'bad', citations: [{ resourceId: 'missing', version: 'v1', spanId: 'x' }] }] })
    const report = await buildReport(snapshot)
    expect(report.findings).toHaveLength(1)
    expect(report.finalVersion).toBe(2)
    const html = reportHtml(report)
    expect(html).toContain('First answer · v1')
    expect(html).toContain('Final answer · v2')
    expect(html).toContain('href="#excerpt-1"')
    expect(html).toContain('Exact synthetic passage')
    expect(html).toContain('break-before: page')
  })
})

describe('offline rendering (Chromium mocked; actual PDF checked by W2)', () => {
  it('uses page.pdf and closes Chromium', async () => {
    const page = { route: vi.fn(), setContent: vi.fn(), emulateMedia: vi.fn(), pdf: vi.fn() }
    const browser = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn().mockResolvedValue(undefined) }
    vi.mocked(chromium.launch).mockResolvedValue(browser as unknown as Awaited<ReturnType<typeof chromium.launch>>)
    const path = join(directory, 'report.pdf')
    expect(await renderReport(await buildReport(run()), path)).toEqual({ format: 'PDF', path })
    expect(page.pdf).toHaveBeenCalledWith(expect.objectContaining({ path, format: 'A4', preferCSSPageSize: true }))
    expect(browser.close).toHaveBeenCalledOnce()
  })
  it('writes printable HTML on unavailable Chromium and escapes source content', async () => {
    vi.mocked(chromium.launch).mockRejectedValue(new Error('Chromium not installed'))
    const snapshot = run(); snapshot.question = '<script>alert("x")</script>'
    const result = await renderReport(await buildReport(snapshot), join(directory, 'report.pdf'))
    expect(result.format).toBe('HTML')
    const html = await readFile(result.path, 'utf8')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('SIMULATED SGD · no real funds')
  })
  it('closes Chromium and returns HTML when PDF generation fails', async () => {
    const page = { route: vi.fn(), setContent: vi.fn(), emulateMedia: vi.fn(), pdf: vi.fn().mockRejectedValue(new Error('PDF failed')) }
    const browser = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn().mockResolvedValue(undefined) }
    vi.mocked(chromium.launch).mockResolvedValue(browser as unknown as Awaited<ReturnType<typeof chromium.launch>>)
    const result = await renderReport(await buildReport(run()), join(directory, 'failed.pdf'))
    expect(result.format).toBe('HTML')
    expect(browser.close).toHaveBeenCalledOnce()
    expect(await readFile(result.path, 'utf8')).toContain('Print this HTML page')
  })
  it('fails closed before launching a browser for tampered report access or citations', async () => {
    const report = await buildReport(paidRun()); report.access!.grants = []
    await expect(renderReport(report, join(directory, 'bad.pdf'))).rejects.toThrow('matching delivery grant')
    const invalid = await buildReport(run()); invalid.findings[0].citations[0].spanId = 'fake'
    await expect(renderReport(invalid, join(directory, 'bad.pdf'))).rejects.toThrow('invalid citations')
    expect(chromium.launch).not.toHaveBeenCalled()
  })
})

describe('citation deep links (#147)', () => {
  it('a FREE citation links to the writer page and the passage anchor exists there', async () => {
    const { miniCorpus } = await import('./fixtures/corpus-mini/index.js')
    const { serve } = await import('./site-serve.js')
    const article = miniCorpus.articles.find(a => a.tier === 'FREE' && a.publisherSlug === 'load-factor')!
    const passage = article.passages[1]
    const text = JSON.stringify(run()).replaceAll('example-free', article.articleId).replaceAll('demand-1', passage.id)
    const snapshot = JSON.parse(text) as RunSnapshot
    snapshot.candidates[0].publisherSlug = article.publisherSlug
    snapshot.contents[0].spans = [{ id: passage.id, text: passage.text }]
    snapshot.contents[0].body = passage.text
    const html = reportHtml(await buildReport(snapshot))
    const href = `/w/load-factor/blog/${article.articleId}#p-${passage.id}`
    expect(html).toContain(`href="${href}"`)
    const page = await (await fetch(`${await serve(miniCorpus)}${href.split('#')[0]}`)).text()
    expect(page).toContain(`id="${href.split('#')[1]}"`)
  })
})
