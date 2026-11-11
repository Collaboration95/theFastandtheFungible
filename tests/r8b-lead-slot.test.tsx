// @vitest-environment jsdom
// R8-B (mock judges r8, H8-07 and H8-21): the lead slot never holds an apology, a sentence cut after an abbreviation, or a
// lowercase fragment; a second sentence must add something the question asked; the context paragraph carries no
// off-question or dangling sentence. Every name and sentence below is invented, except where a line quotes the round-8 report.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { leadFinding, missingQualifiers, qualifierNames, sentences } from '../shared/lead-finding'
import { summarizeAnswer } from '../shared/answer-summary'
import { exampleAnswer, exampleCandidate, exampleContent } from '../shared/contracts/examples'
import type { Claim } from '../shared/contracts/index'
import Answer, { finding, validatedAnswers } from '../src/components/Answer'
import { ucRuns } from '../src/fixtures/run'

afterEach(cleanup)
const claim = (id: string, text: string, resourceId = 'doc'): Claim => ({ id, text, stance: 'UNCERTAIN', citations: [{ resourceId, version: 'v1', spanId: id }] })
const lead = (question: string, ...texts: string[]) => leadFinding(question, texts.map((text, i) => claim(`s${i}`, text, `doc${i}`))).map(item => item.text)
/** One delivered article, its sentences as one passage each. */
function article(title: string, facets: string[], texts: string[]) {
  const content = { ...exampleContent, title, body: texts.join(' '), spans: texts.map((text, i) => ({ id: `p${i}`, text })) }
  return { content, candidate: { ...exampleCandidate, title, facets } }
}

describe('sentence cuts', () => {
  it('never cut after an abbreviation: "U.S. Treasury", "e.g.", "No.", a single initial', () => {
    expect(sentences('Ripple describes RLUSD as a stablecoin backed by U.S. Treasury bills and cash. A bank holds the reserve.')).toEqual(['Ripple describes RLUSD as a stablecoin backed by U.S. Treasury bills and cash.', 'A bank holds the reserve.'])
    expect(sentences('Pick a flag, e.g. Tradable, before signing. Then submit it.')).toEqual(['Pick a flag, e.g. Tradable, before signing.', 'Then submit it.'])
    expect(sentences('See Recommendation No. 16 for the rule. It applies to providers.')).toHaveLength(2)
    expect(sentences('The reserve was set by J. Smith in 2024. It has not changed.')).toHaveLength(2)
    // The merged sentence is an exact substring of the source, whitespace included.
    const source = 'It holds U.S.  Treasury bills.   Next.'
    expect(sentences(source).every(part => source.includes(part))).toBe(true)
  })
  it('does not lead with a sentence stopped at "U.S."', () => {
    const text = 'Ripple describes RLUSD as a fiat-backed stablecoin supported one-to-one by U.S. dollar deposits, U.S. Treasury securities and cash equivalents held in segregated accounts.'
    const picked = lead('Is RLUSD a regulated stablecoin?', text)
    expect(picked.every(sentence => !/U\.S\.$/.test(sentence))).toBe(true)
  })
})

describe('capitalisation', () => {
  it.each([
    ['key-reveal escrow makes payment atomic', 'Key-reveal escrow makes payment atomic.'],
    ['prompt injection cannot raise the budget', 'Prompt injection cannot raise the budget.'],
    ['the only supported type is PREIMAGE-SHA-256.', 'The only supported type is PREIMAGE-SHA-256.'],
    ['x402 sends a header', 'x402 sends a header.'],
    ['tesSUCCESS appears in a validated ledger.', 'tesSUCCESS appears in a validated ledger.'],
    ['rippled stores ledgers.', 'rippled stores ledgers.'],
    ['npm install researchagent', 'npm install researchagent.'],
    ['Already a sentence.', 'Already a sentence.'],
  ])('%s', (text, expected) => expect(finding(text)).toBe(expected))
})

describe('fragments never lead', () => {
  it('skips an extract that continues an earlier sentence, and leads with the next real one', () => {
    const picked = lead('What does the broker verify before settling?', 'which means the broker verifies the payment before settling the transaction', 'The broker verifies the payment before settling the transaction.')
    expect(picked).toEqual(['The broker verifies the payment before settling the transaction.'])
    expect(lead('What does the broker verify before settling?', 'and the broker verifies the payment before settling.')).toEqual([])
  })
})

describe('a qualifier no source names does not discard an on-topic answer', () => {
  const texts = [
    'The travel rule applies to virtual-asset transfers: the originating provider must obtain required originator information and required beneficiary information and send it to the beneficiary institution.',
    'Countries may adopt a de minimis threshold for virtual-asset transfers.',
  ]
  const question = 'What travel-rule information must a VASP send with a crypto transfer in Singapore?'
  it('leads with the sentence that covers the question, though "Singapore" appears nowhere', () => {
    expect(lead(question, ...texts)[0]).toBe(texts[0])
    expect(qualifierNames(question)).toEqual(['Singapore'])
    expect(missingQualifiers(question, [texts.join(' ')])).toEqual(['Singapore'])
    expect(missingQualifiers(question, [`${texts[0]} Singapore adopted it.`])).toEqual([])
  })
  it('still declines when the sentence barely touches the question, or the missing name is the subject', () => {
    expect(lead(question, 'A sidechain is a separate ledger with its own rules in a different region.')).toEqual([])
    // "South Valley Council" is what the question is about, not a qualifier: no lead from another council's decision.
    const { content, candidate } = article('September decision', ['meeting', 'rates'], ['Members voted to raise the service rate by 25 bp.'])
    expect(summarizeAnswer('What did the South Valley Council change at its last meeting?', exampleAnswer, [content], [candidate]).lead).toEqual([])
  })
})

describe('a later clause of a two-clause question cannot veto the answer to the first (R8-A repro: the x402 402 question)', () => {
  const question = 'What does a widget response contain, and can my agent pay it with XRP on Frobnet?'
  const texts = ['a widget response lists the allowed options in the WIDGET-OPTIONS header; the client picks one and retries with WIDGET-PROOF.', 'Each option names scheme, amount, asset and timeout; extra carries scheme-specific details.']
  const claims = texts.map((text, i) => claim(`s${i}`, text, 'widget-article'))
  const candidates = [{ ...exampleCandidate, resourceId: 'widget-article', title: 'What does a widget response contain?', facets: ['widget', 'response', 'WIDGET-OPTIONS'] }]
  it('leads with the sentence that answers the first clause, though the article never says "Frobnet"', () => {
    // The question as the requested fact too, as the loop passes it: nothing in the article names Frobnet.
    const picked = leadFinding(question, claims, undefined, question, candidates).map(item => item.text)
    expect(picked[0]).toBe(texts[0])
    expect(qualifierNames(question)).toEqual(['Frobnet'])
    expect(missingQualifiers(question, texts)).toEqual(['Frobnet'])
  })
  it('gives the one-clause question the same lead', () => {
    expect(leadFinding('What does a widget response contain?', claims, undefined, undefined, candidates)[0].text).toBe(texts[0])
  })
})

describe('a second lead sentence must add a requested facet', () => {
  const question = 'How long does a payment take to become final, and when should an agent treat it as settled?'
  const first = 'An agent should treat a successful payment as final only when its result appears in a validated ledger; an initial submit response is provisional.'
  it('is not an off-question template (R8 A5)', () => {
    expect(lead(question, first, 'The native path uses the exact scheme and network xrpl:1 for every payment.')).toEqual([first])
  })
  it('is not the first sentence again (R8 B3)', () => {
    expect(lead(question, first, 'An agent should treat a successful payment as final only when its result appears in a validated ledger.')).toEqual([first])
  })
  it('is added when it answers a later clause the first sentence left open', () => {
    const q = 'How long does a payment take to become final, and how often do ledgers advance?'
    const claims = [claim('a', 'A payment is final once its result appears in a validated ledger.', 'doc0'), claim('b', 'The ledger advances every few seconds.', 'doc1')]
    const candidates = [{ ...exampleCandidate, resourceId: 'doc0', title: 'Payment finality', facets: ['payment', 'final'] }, { ...exampleCandidate, resourceId: 'doc1', title: 'Payment finality and ledger timing', facets: ['payment', 'ledger'] }]
    expect(leadFinding(q, claims, undefined, undefined, candidates).map(item => item.text)).toEqual(['A payment is final once its result appears in a validated ledger.', 'The ledger advances every few seconds.'])
    // The same two sentences for a one-clause question: the second asks nothing more, so it stays out.
    expect(leadFinding('How long does a payment take to become final?', claims, undefined, undefined, candidates)).toHaveLength(1)
  })
})

describe('the context paragraph', () => {
  const question = 'Is RLUSD a regulated stablecoin, and who supervises its issuer?'
  const run = (texts: string[]) => {
    const { content, candidate } = article('RLUSD issuer and oversight', ['RLUSD', 'issuer', 'regulation'], texts)
    // Every passage is cited by a claim, as in a real answer: the context paragraph is built from cited passages.
    const claims = content.spans.map(span => ({ id: span.id, text: span.text, stance: 'SUPPORTS' as const, citations: [{ source: content.source, resourceId: content.resourceId, version: content.version, spanId: span.id }] }))
    return summarizeAnswer(question, { ...exampleAnswer, claims }, [content], [candidate]).conclusion
  }
  it('drops a statement about what the docs lack when it is about another question (R8 A1)', () => {
    const conclusion = run(['RLUSD is issued by a New York trust company that its regulator supervises.', 'The docs contain no verified list of Singapore banks piloting RLUSD settlement in 2026.'])
    expect(conclusion).toContain('regulator supervises')
    expect(conclusion).not.toContain('Singapore banks')
  })
  it('drops a disclaimer that points back with "They" (R8 E3), keeps a sentence that follows its antecedent', () => {
    const conclusion = run(['RLUSD is a stablecoin whose issuer is supervised by a state regulator.', 'A market route and an issuer relationship are different operational arrangements.', 'They are not a determination that RLUSD is regulated everywhere.'])
    expect(conclusion).not.toContain('They are not a determination')
    expect(run(['RLUSD is a stablecoin and its issuer is supervised by a state regulator.', 'It must also publish monthly attestations about the issuer.'])).toContain('It must also publish')
  })
  it('drops a pronoun sentence whose antecedent was left out', () => {
    expect(run(['RLUSD is a stablecoin and its issuer is supervised by a state regulator.', 'Unrelated filler about an unrelated cooling plant.', 'It must also publish monthly attestations about the issuer.'])).not.toContain('It must also publish')
  })
})

describe('the lead slot in the answer view', () => {
  const base = () => {
    const run = structuredClone(ucRuns.UC2)
    const answer = validatedAnswers(run).at(-1)!
    return { run, answer, picked: leadFinding(run.question, answer.claims, run.contents, undefined, run.candidates) }
  }
  const view = (run: typeof ucRuns.UC2) => render(<Answer run={run} view="latest" onView={() => {}} compare={false} onCompare={() => {}} />)
  it('says plainly that no single sentence answers, never an apology, when claims exist but no lead was chosen', () => {
    const { run } = base()
    run.answers = run.answers.map(answer => ({ ...answer, lead: [] }))
    view(run)
    expect(screen.getByText('The sources don’t state this in one sentence. What they say is below.')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/No concise finding|could not be selected/)
  })
  it('says which qualifier the cited sources never mention', () => {
    const { run, answer, picked } = base()
    expect(picked.length).toBeGreaterThan(0)
    run.question = `${run.question.replace(/\?$/, '')} in Atlantis?`
    run.answers = run.answers.map(item => ({ ...item, lead: picked }))
    view(run)
    expect(screen.getByText('The cited sources don’t mention Atlantis.')).toBeTruthy()
    expect(answer.claims.length).toBeGreaterThan(0)
  })
  it('does not add the line when the sources do name it', () => {
    const { run, picked } = base()
    run.answers = run.answers.map(item => ({ ...item, lead: picked }))
    view(run)
    expect(document.querySelector('.ra-lead-note')).toBeNull()
  })
})
