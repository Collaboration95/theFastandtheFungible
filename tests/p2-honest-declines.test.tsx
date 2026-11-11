// P2 · honest declines: the retention promise follows the real schedule, a topic-rejected article reads "Not about this question",
// both team writers carry one label, and a signed fact menu never reaches a card as a bare tag such as "client requirements".
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import Verification from '../src/components/Verification'
import { exampleCandidate, exampleRun } from '../shared/contracts/examples.js'
import type { PurchaseIntent, RunSnapshot } from '../shared/contracts/index.js'
import { CLAIM_KINDS } from '../shared/manifest.js'
import { promiseLabel } from '../shared/promise-label.js'
import {
  HOSTED_PROOF_PROMISE, HOSTED_PROOF_RETAIN_UNTIL, TEAM_WRITER_NAME, TOPIC_MISS_WORDS, VERDICT_WORDS, describeRefusal, proofWriter, verdictWords,
} from '../shared/refusal-proof.js'

describe('retention promise', () => {
  it('is "through 19 November 2026", which is the end of 19 Nov in Singapore, before the providers end (20 Nov 00:00 SGT) and the VM stops (00:30)', () => {
    expect(HOSTED_PROOF_PROMISE).toBe('through 19 November 2026')
    const until = Date.parse(HOSTED_PROOF_RETAIN_UNTIL)
    expect(until).toBe(Date.parse('2026-11-20T00:00:00+08:00'))
    expect(until).toBeLessThanOrEqual(Date.parse('2026-11-20T00:30:00+08:00'))
    expect(new Date(until - 1).toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'long', year: 'numeric' })).toBe('19 November 2026')
  })
  it('no longer promises 21 November anywhere a visitor reads it', () => {
    for (const file of ['shared/refusal-proof.ts', 'src/components/ShareProof.tsx', 'docs/contracts/REFUSAL-PROOF.md']) expect(readFileSync(file, 'utf8'), file).not.toMatch(/21 Nov/)
  })
})

const row = (patch: { verdict: string; reason?: string; addressesGap?: number; derivedFrom?: string }) => ({
  verdict: patch.verdict, reason: patch.reason ?? 'Value is under the bar.',
  judgment: { addressesGap: patch.addressesGap ?? 0.5, originality: { original: 0.5, rewrite: 0.5, overlap: 0 }, credibility: 1 },
  candidate: { derivedFrom: patch.derivedFrom },
}) as Parameters<typeof verdictWords>[0]

describe('topic-rejected candidates', () => {
  it('read "Not about this question", whether the topic guard or the judge said so', () => {
    expect(TOPIC_MISS_WORDS).toBe('Not about this question')
    expect(verdictWords(row({ verdict: 'SKIP_LOW_VALUE', reason: 'The article title and topics do not cover the requested subject.' }))).toBe(TOPIC_MISS_WORDS)
    // A fictional Kestrel article against an XRPL question: the judge scores it 0, and a tie with "original" used to flag it a rewrite.
    expect(verdictWords(row({ verdict: 'SKIP_REWRITE', reason: 'Already acquired or a rewrite of existing evidence.', addressesGap: 0 }))).toBe(TOPIC_MISS_WORDS)
    expect(verdictWords(row({ verdict: 'SKIP_LOW_VALUE', addressesGap: 0 }))).toBe(TOPIC_MISS_WORDS)
  })
  it('keeps the other words for what they are true of', () => {
    expect(verdictWords(row({ verdict: 'SKIP_REWRITE', reason: 'Already acquired or a rewrite of existing evidence.', derivedFrom: 'free-source' }))).toBe('Repeats what is already known')
    expect(verdictWords(row({ verdict: 'SKIP_REWRITE' }))).toBe(VERDICT_WORDS.SKIP_REWRITE)
    expect(verdictWords(row({ verdict: 'SKIP_LOW_VALUE' }))).toBe('Wouldn’t add enough')
    expect(verdictWords(row({ verdict: 'SKIP_OVER_BUDGET' }))).toBe('Over the budget left')
  })
  it('is what a published proof lists for such an article, with the same words on a repeated article', () => {
    const base = { candidates: [], decisions: [] } as unknown as Pick<RunSnapshot, 'candidates' | 'decisions'>
    const paid = { ...exampleCandidate, tier: 'PAID' as const }
    const miss = { ...row({ verdict: 'SKIP_REWRITE', addressesGap: 0 }), candidate: paid }
    const found = describeRefusal({ ...base, candidates: [paid], decisions: [{ round: 1, rows: [miss] }] } as unknown as Pick<RunSnapshot, 'candidates' | 'decisions'>).found
    expect(found.items.map(item => item.verdict)).toEqual([TOPIC_MISS_WORDS])
  })
})

describe('one writer label', () => {
  it('names both team writers the same way, however the catalogue spells them', () => {
    for (const publisher of ['ResearchAgent builders', 'ResearchAgent builders (team-authored)', 'ResearchAgent builders · XRPL explainers (team-authored)', 'ResearchAgent builders · Build notes (team-authored)']) expect(proofWriter(publisher), publisher).toBe(TEAM_WRITER_NAME)
    expect(TEAM_WRITER_NAME).toBe('ResearchAgent builders (team-authored)')
  })
  it('leaves any other writer’s name alone', () => {
    expect(proofWriter('The Fab Floor')).toBe('The Fab Floor')
    expect(proofWriter('Kopi Contrarian · Thursday notes')).toBe('Kopi Contrarian')
  })
})

/** The claims a team article's signed manifest carries, built the way publisher/manifest.ts builds them. */
function teamClaims() {
  const root = 'data/corpus/v2/articles'
  const out: { article: string; claim: { id: string; kind: string; covers: { entity: string; measure: string; period?: string; comparison?: string } } }[] = []
  for (const slug of ['team-xrpl-explainers', 'team-builder-notes']) for (const file of readdirSync(join(root, slug)).sort()) {
    const article = JSON.parse(readFileSync(join(root, slug, file), 'utf8')) as { articleId: string; passages: { id: string; text: string }[]; factMenu?: Record<string, never> }
    for (const passage of article.passages) {
      const covers = article.factMenu?.[passage.id] as { entity: string; measure: string; period?: string; comparison?: string } | undefined
      if (!covers) continue
      for (const [kind, holds] of Object.entries(CLAIM_KINDS)) if ((holds as (text: string) => boolean)(passage.text)) out.push({ article: `${slug}/${article.articleId}`, claim: { id: `${passage.id}:${kind}`, kind, covers } })
    }
  }
  return out
}

describe('promise labels', () => {
  const claims = teamClaims()
  it('covers a real spread of team articles', () => {
    expect(new Set(claims.map(item => item.article)).size).toBeGreaterThan(50)
    expect(new Set(claims.map(item => `${item.claim.covers.entity} ${item.claim.covers.measure}`)).size).toBeGreaterThan(50)
  })
  it('never prints a signed fact menu as a bare tag ("client requirements", "XRPL cost", "issuer issuer")', () => {
    for (const { article, claim } of claims) {
      const label = promiseLabel(claim as never), { entity, measure } = claim.covers
      expect(label, article).toMatch(/^Mentions \S/)
      expect(label, `${article}: ${label}`).not.toContain(`${entity} ${measure}`)
      expect(label.toLowerCase(), article).not.toBe(`${entity} ${measure}`.toLowerCase())
      expect(label, article).not.toMatch(/[:_]|\bp\d+\b|SKIP_|undefined/)
    }
  })
  it('lists, for every team article’s fact menu, the row it gets (snapshot: read it as a reader would)', async () => {
    const rows = new Map<string, number>()
    for (const { claim } of claims) { const label = promiseLabel(claim as never); rows.set(label, (rows.get(label) ?? 0) + 1) }
    const listing = [...rows].sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) => `${label}  ×${count}`).join('\n') + '\n'
    await expect(listing).toMatchFileSnapshot('./__snapshots__/p2-team-promise-labels.txt')
  })
  it('words a claim with no fact menu by its kind, never by its id', () => {
    expect(promiseLabel({ id: 'p1:dated-figure', kind: 'dated-figure' })).toBe('Gives a dated figure')
    expect(promiseLabel({ id: 'p2:named-source', kind: 'named-source' })).toBe('Names its source')
    expect(promiseLabel({ id: 'p3:numeric-series', kind: 'numeric-series' })).toBe('Gives a series of numbers')
    expect(promiseLabel({ id: 'p9:something-new' })).toBe('Keeps a promised detail')
    expect(promiseLabel({ id: 'a', covers: { entity: 'issuer', measure: 'issuer' } })).toBe('Mentions issuer')
    expect(promiseLabel({ id: 'a', covers: { entity: 'Kestrel', measure: 'prepayment', period: 'twenty twenty seven' } })).toBe('Mentions Kestrel and prepayment in 2027')
    expect(promiseLabel({ id: 'a', covers: { entity: 'Kestrel', measure: 'margin', comparison: 'TSMC' } })).toBe('Mentions Kestrel, margin and TSMC')
  })
  it('is what the payment card’s “Checked against the writer’s promises” lists, for every team article', () => {
    const sample = claims.filter((_, index) => index % 7 === 0).slice(0, 40)
    const intent = { ...exampleRun.intents[0], intentId: 'i', profileId: exampleCandidate.profileId, resourceId: exampleCandidate.resourceId, version: 'v1', status: 'VERIFIED' } as unknown as PurchaseIntent
    for (const { article, claim } of sample) {
      const run = { ...exampleRun, intents: [intent], candidates: [{ ...exampleCandidate, manifest: { claims: [claim] } }] } as unknown as RunSnapshot
      const html = renderToStaticMarkup(<Verification run={run} intent={intent} />)
      const { entity, measure } = claim.covers
      expect(html, article).toContain(promiseLabel(claim as never))
      expect(html, article).not.toContain(`${entity} ${measure}<`)
      expect(html, article).not.toMatch(new RegExp(`>${entity} ${measure}<`))
    }
  })
})
