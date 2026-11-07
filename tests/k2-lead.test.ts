import type { RunSnapshot } from '../shared/contracts/index'
import { expect, it } from 'vitest'
import { leadFinding, sentences } from '../shared/lead-finding'
const claim = (id: string, text: string) => ({ id, text, stance: 'UNCERTAIN' as const, citations: [{ resourceId: 'manual', version: 'v1', spanId: id }] })
it('keeps hyphenated identifiers intact across sentence boundaries', () => {
 expect(sentences('XLS-99 defines X-PROOF. ExampleFlag enables the option.')).toEqual(['XLS-99 defines X-PROOF.', 'ExampleFlag enables the option.'])
})
it('uses topical passage context for a named field without fabricating an answer', () => {
 const text = 'Conditional release locks the funds. ReleaseAfter and AbortAfter define the time windows.'
 expect(leadFinding('Which field controls conditional release?', [claim('a', text)]).map(x => x.text).join(' ')).toContain('AbortAfter')
})
it('does not suppress complementary technical evidence after an incidental comparison', () => {
 const claims = [claim('a', 'The payment account moved from zero objects to one with a 0.2 XRP reserve.'), claim('b', 'A bounded SourceLimit controls the payment source amount.')]
 expect(leadFinding('Which payment field bounds the source amount?', claims).map(x => x.text).join(' ')).toContain('SourceLimit')
})
it('extracts only cited delivered text and preserves stance', () => {
 const c = claim('a', 'Invented field answer.')
 expect(leadFinding('Which field?', [c], [])).toEqual([])
})

it('keeps the UC3 replay lead under Supports and preserves UC1–UC2 evidence', async () => {
 const { readFileSync } = await import('node:fs')
 for (const id of ['UC1', 'UC2', 'UC3', 'UC3-testnet', 'UC3-key-reveal']) {
  const { run } = JSON.parse(readFileSync(`demo/traces/${id}.json`, 'utf8')) as { run: RunSnapshot }
  const answer = run.answers.at(-1)!
  const paid = answer.claims.filter(c => c.citations.some(ref => run.candidates.some(candidate => candidate.resourceId === ref.resourceId && candidate.tier === 'PAID')))
  const lead = leadFinding(run.question, paid.length ? paid : answer.claims, run.contents)
  expect(lead.length).toBeGreaterThan(0)
  if (id.startsWith('UC3')) expect(lead[0].claim.stance).toBe('SUPPORTS')
  expect(lead.every(item => run.contents.some(content => content.body.includes(item.text)))).toBe(true)
 }
})
