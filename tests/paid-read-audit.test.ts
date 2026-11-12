import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import express from 'express'
import { afterEach, expect, it, vi } from 'vitest'
import { RunLoop } from '../server/agents/loop.js'
import { reportsRouter } from '../server/api/reports.js'
import type { ApiContext } from '../server/api/context.js'
import { checkProof } from '../server/proofs.js'
import { receiptBundle } from '../server/receipt-bundle.js'
import type { AuditEntry } from '../server/audit.js'
import { Store } from '../server/store.js'
import { summarizeGates } from '../src/verify/gates.js'
import type { ReceiptBundle } from '../shared/contracts/receipts.js'
import { resources } from './helpers/resource-scope.js'
import { miniCorpus } from './fixtures/corpus-mini/index.js'
import { alphaLeakArticle, honestArticle, payPath } from './fixtures/pay-path.js'

const cleanups: (() => void | Promise<void>)[] = []
afterEach(async () => { vi.restoreAllMocks(); for (const fn of cleanups.splice(0).reverse()) await fn() })
async function setup(options?: Parameters<typeof payPath>[0]) {
  const h = await payPath(options); cleanups.push(h.close); return h
}
const scratch = () => resources().tempDir('g1-tel-')

it('exports fresh paid reads through the hosted receipt route; TS and Python verifiers pass and gate 1 is Held', async () => {
  const h = await setup({ writers: miniCorpus })
  const run = h.store.createRun('What does the Kestrel TSMC deal say about contracted demand?', 200)
  const candidate = await h.candidate(honestArticle)
  await new RunLoop(h.store, h.client, h.manager, undefined, {
    retrieve: async () => ({ candidates: [candidate], contents: [], hits: [], dropped: [], unavailable: [] }),
    provider: { name: 'fixture', model: 'paid-read-test', judgeRound: async () => ({ gapMaterial: 0.9 }),
      judgeCandidate: async () => ({ addressesGap: 1, originality: { original: 0.9, rewrite: 0.05, overlap: 0.05 }, credibility: 1 }) },
    threshold: 0.01,
  }).start(run.runId)
  const done = h.store.getRun(run.runId)
  expect(done.phase).toBe('DONE')
  expect(done.intents.some(i => i.status === 'VERIFIED')).toBe(true)
  // This is the router used by the hosted export; auth/admission is covered separately.
  const app = express().use(reportsRouter({ store: h.store } as ApiContext))
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanups.push(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())) })
  const response = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/runs/${run.runId}/receipts.json`)
  expect(response.status).toBe(200)
  const bundle = await response.json() as ReceiptBundle
  const entries = bundle.audit.entries.filter((e): e is AuditEntry => !('commitment' in e))
  const reads = entries.filter(e => e.kind === 'read_paid')
  expect(reads.length).toBeGreaterThan(0)
  for (const intent of done.intents.filter(i => i.status === 'VERIFIED')) {
    const content = h.store.getDelivery(intent.intentId)!.content
    const grant = entries.find(e => e.kind === 'grant' && e.intentId === intent.intentId)!
    expect(grant).toBeDefined()
    expect(reads.filter(e => e.intentId === intent.intentId)).toHaveLength(content.spans.length)
    for (const passage of content.spans) {
      const read = reads.find(e => e.intentId === intent.intentId && e.data.passageId === passage.id)!
      expect(read.runId).toBe(run.runId)
      expect(read.seq).toBeGreaterThan(grant.seq)
      expect(read.data).toEqual({ passageId: passage.id, passageSha256: createHash('sha256').update(passage.text, 'utf8').digest('hex') })
    }
  }
  const gate = summarizeGates(bundle)[0]
  expect(gate).toMatchObject({ status: 'Held', detail: 'Recorded paid reads follow their grants.' })
  for (const entry of entries.filter(e => ['read_paid', 'grant'].includes(e.kind))) expect(gate.seqs).toContain(entry.seq)
  const dir = scratch(), path = join(dir, 'fresh.receipts.json')
  writeFileSync(path, JSON.stringify(bundle))
  // Defaults exercise the unchanged repo verifiers. The release acceptance run sets these to
  // the actual downloaded v1.1.1 SDK tarball and Python wheel (no verifier semantics changed).
  const tsVerifier = pathToFileURL(resolve(process.env.G1_TEL_TS_VERIFIER ?? 'sdk/verify.ts')).href
  const ts = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    'import {readFileSync} from "node:fs"; const {verifyAnswer}=await import(process.argv[1]); console.log(JSON.stringify(await verifyAnswer(JSON.parse(readFileSync(process.argv[2],"utf8")))));', tsVerifier, path], { encoding: 'utf8' }))
  const python = JSON.parse(execFileSync('python3', ['-m', 'researchagent', 'verify', path, '--json'], {
    encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONPATH: resolve(process.env.G1_TEL_PYTHON_PATH ?? 'packages/sdk-python/src') },
  }))
  for (const result of [ts, python]) {
    expect(result.checks.filter((c: { status: string }) => c.status === 'FAIL')).toEqual([])
    expect(result.ok).toBe(true)
  }
  // Repeated snapshots/exports and a later anchor must neither duplicate nor omit these events.
  expect(receiptBundle(h.store, run.runId).audit).toEqual(bundle.audit)
  const tip = h.store.auditEntries().at(-1)!
  h.store.saveAnchor({ runId: run.runId, head: tip.hash, seq: tip.seq, answersHash: 'a'.repeat(64) })
  h.store.recordAudit({ kind: 'policy', data: { test: 'unrelated later entry' } })
  expect(receiptBundle(h.store, run.runId).audit).toEqual(bundle.audit)
  console.log(JSON.stringify({ gate1: gate, verifiers: { typescript: ts.ok, python: python.ok }, readCount: reads.length }))
}, 30_000)

it('quarantines an unverified delivery, records nothing before proof, and persists exactly one event per released passage', async () => {
  const dir = scratch(), path = join(dir, 'state.db'), h = await setup({ storePath: path })
  const run = h.store.createRun('Kestrel lead times', 200), candidate = await h.candidate(honestArticle)
  h.store.updateRun(run.runId, { candidates: [candidate] })
  const proof = vi.spyOn(h.store, 'recordProof').mockImplementation(id => h.store.getIntent(id)!)
  await h.manager.purchase({ runId: run.runId, candidate, intentId: 'fresh-paid-read' })
  const delivery = h.store.getDelivery('fresh-paid-read')!
  expect(h.store.getRun(run.runId).contents).toEqual([])
  expect(() => h.store.addContent(run.runId, delivery.content)).toThrow('Paid or unknown content requires verified grant')
  expect(h.store.auditEntries().filter(e => ['grant', 'read_paid'].includes(e.kind))).toEqual([])
  proof.mockRestore()
  checkProof(h.store, 'fresh-paid-read')
  // If the audit cannot commit, no passage can leave and the grant/read writes roll back together.
  const append = h.store.audit.append.bind(h.store.audit)
  const failure = vi.spyOn(h.store.audit, 'append').mockImplementation(input => { if (input.kind === 'read_paid') throw Error('audit unavailable'); return append(input) })
  expect(() => h.store.getRun(run.runId)).toThrow('audit unavailable')
  expect(h.store.auditEntries().filter(e => ['grant', 'read_paid'].includes(e.kind))).toEqual([])
  failure.mockRestore()
  expect(h.store.getRun(run.runId).contents).toHaveLength(1)
  const before = h.store.auditEntries()
  const reopened = new Store(path)
  try {
    for (let n = 0; n < 3; n++) expect(reopened.getRun(run.runId).contents).toHaveLength(1)
    expect(reopened.auditEntries()).toEqual(before)
    expect(before.filter(e => e.kind === 'grant')).toHaveLength(1)
    expect(before.filter(e => e.kind === 'read_paid')).toHaveLength(delivery.content.spans.length)
  } finally { reopened.close() }
})

it('never records a paid read for a failed proof', async () => {
  const h = await setup(), run = h.store.createRun('Kestrel lead times', 200), candidate = await h.candidate(alphaLeakArticle)
  h.store.updateRun(run.runId, { candidates: [candidate] })
  const intent = await h.manager.purchase({ runId: run.runId, candidate, intentId: 'bad-proof' })
  expect(intent.status).toBe('CLAIM_FAILED')
  expect(h.store.getRun(run.runId).contents).toEqual([])
  expect(h.store.auditEntries().filter(e => ['grant', 'read_paid'].includes(e.kind))).toEqual([])
})
