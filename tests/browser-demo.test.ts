import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { RunSnapshotSchema } from '../shared/contracts/index.js'
import { runEvents, staged } from '../src/stage'
for (const id of ['UC1', 'UC2', 'UC3', 'UC3-testnet', 'UC-key-reveal', 'UC3-key-reveal']) it(`${id}: committed engine trace preserves grant and citation boundaries at every replay event`, () => {
  const capture = JSON.parse(readFileSync(`demo/traces/${id}.json`, 'utf8'))
  const run = RunSnapshotSchema.parse(capture.run)
  expect(run.phase).toBe('DONE')
  if (id.startsWith('UC3') || id === 'UC-key-reveal') {
    const lead = run.answers.at(-1)?.claims.find(c => /26 weeks to 18 weeks/.test(c.text))
    expect(lead?.stance).toBe('SUPPORTS')
  }
  expect(run.labels.research).toMatch(/^fixture/)
  expect(run.labels.settlement).toMatch(id.includes('testnet') || id.includes('key-reveal') ? /XRPL TESTNET/ : /SIMULATED/)
  expect(run.events.some(e => e.type === 'FREE_DRAFT')).toBe(true)
  for (const event of runEvents(run)) {
    const shown = staged(run, event.id)
    for (const content of shown.contents) {
      const candidate = run.candidates.find(c => c.resourceId === content.resourceId && c.version === content.version)!
      if (candidate.tier === 'PAID') {
        expect(shown.grants.some(g => g.resourceId === content.resourceId && g.version === content.version)).toBe(true)
        expect(shown.events.some(e => e.type === 'GRANT' && e.data?.intentId === shown.grants.find(g => g.resourceId === content.resourceId)?.intentId)).toBe(true)
      }
    }
    for (const answer of shown.answers) for (const claim of answer.claims) for (const citation of claim.citations) {
      const content = shown.contents.find(c => c.resourceId === citation.resourceId && c.version === citation.version)
      expect(content?.spans.some(span => span.id === citation.spanId && content.body.includes(span.text))).toBe(true)
    }
    for (const intent of run.intents.filter(i => i.status === 'REFUNDED')) expect(shown.contents.some(c => c.resourceId === intent.resourceId)).toBe(false)
  }
  if (id === 'UC3') { expect(run.refundedMinor).toBe(30); expect(run.intents.some(i => i.status === 'REFUNDED')).toBe(true) }
  if (id !== 'UC1') expect(run.answers.length).toBeGreaterThan(1)
})

it('audits raw terminal snapshots, including nested event payloads, before bundling', () => {
  for (const id of ['UC1','UC2','UC3','UC3-testnet','UC-key-reveal', 'UC3-key-reveal']) {
    const raw = readFileSync(`demo/traces/${id}.json`, 'utf8')
    const capture = JSON.parse(raw), run = RunSnapshotSchema.parse(capture.run)
    expect(capture.provenance.source).toMatch(/^[a-f0-9]{40}$/)
    expect(Date.parse(capture.provenance.capturedAt)).not.toBeNaN()
    for (const content of run.contents) {
      const candidate = run.candidates.find(c => c.resourceId === content.resourceId && c.version === content.version)
      expect(candidate).toBeDefined()
      if (candidate?.tier !== 'PAID') continue
      const grant = run.grants.find(g => g.resourceId === content.resourceId && g.version === content.version)
      expect(grant).toBeDefined()
      expect(run.intents.find(i => i.intentId === grant?.intentId)?.status).toBe('VERIFIED')
      expect(run.events.some(e => e.type === 'GRANT' && e.data?.intentId === grant?.intentId)).toBe(true)
    }
    const walk = (value: unknown) => {
      if (!value || typeof value !== 'object') return
      for (const [key, item] of Object.entries(value)) {
        expect(key).not.toMatch(/^(seed|apiKey|privateKey|signedBlob|txBlob|quarantineBody|ciphertext|fulfillment)$/i)
        if (key === 'body' && typeof item === 'string') expect(run.contents.some(c => c.body === item)).toBe(true)
        walk(item)
      }
    }
    walk(capture)
  }
})

for (const [id, folder] of [['UC3-key-reveal','key-reveal'], ['UC-key-reveal','no-show'], ['UC3-testnet','payment']]) it(`${id}: receipt download and proof strip bind to the displayed recording`, () => {
  const { run } = JSON.parse(readFileSync(`demo/traces/${id}.json`, 'utf8'))
  const root = `docs/evidence/round4-j1/replays/${folder}`
  const bundle = JSON.parse(readFileSync(`${root}/UC3.receipts.json`, 'utf8'))
  expect(bundle.runId).toBe(run.runId)
  const hashes = new Set(run.intents.flatMap((i: { txHash?: string; refund?: { txHash: string }; escrow?: { createHash?: string; finishHash?: string; cancelHash?: string } }) => [i.txHash, i.refund?.txHash, i.escrow?.createHash, i.escrow?.finishHash, i.escrow?.cancelHash]).concat(run.ledgerAnchor?.txHash).filter(Boolean))
  for (const row of JSON.parse(readFileSync(`${root}/transactions.json`, 'utf8')).transactions) expect(hashes.has(row.hash)).toBe(true)
})
