import { describe, expect, it } from 'vitest'
import { answerNames, askedKind, numericKind } from '../shared/answer-entity'
import { leadFinding, onTopicSentence, rankLeadSentences } from '../shared/lead-finding'
import { summarizeAnswer } from '../shared/answer-summary'
import { exampleAnswer, exampleCandidate, exampleContent } from '../shared/contracts/examples'
import type { Claim } from '../shared/contracts/index'

// Every name, sentence and number below is invented for these tests. The rules
// under test are about the SHAPE of an answer (an identifier, a header, a
// percentage, a numbered clause), never about a particular answer.
const claim = (id: string, text: string, resourceId = 'doc'): Claim => ({ id, text, stance: 'UNCERTAIN', citations: [{ resourceId, version: 'v1', spanId: id }] })
const lead = (question: string, ...sentences: string[]) => leadFinding(question, sentences.map((text, i) => claim(`s${i}`, text))).map(item => item.text)

describe('asked kind', () => {
  it.each([
    ['Which widget flag makes a transfer immediate?', 'flag'],
    ['Which transaction type configures a widget group?', 'transaction'],
    ['What HTTP header carries the receipt?', 'header'],
    ['What share of members must approve a change?', 'share'],
    ['In which Recommendation is the disclosure rule set out?', 'numbered'],
    ['Which federal act created the framework?', 'law'],
    ['Which amendment lets a pool hold tokens?', 'standard'],
    ['Which StreamCreate field limits the release time?', 'field'],
    ['How is its currency code written?', 'code'],
    ['How many objects can an account own?', 'quantity'],
    ['What is the reference transaction cost, measured in drops?', 'quantity'],
  ])('%s -> %s', (question, kind) => expect(askedKind(question)).toBe(kind))

  it.each([
    'How does the broker verify a payment before settling the transaction?',
    'What does the broker do after a client signs?',
    'Why does a pool need a reserve?',
    'Is the feature enabled?',
  ])('asks for no named thing: %s', question => expect(askedKind(question)).toBeUndefined())

  it('treats only quantity and share as numeric', () => {
    expect(['share', 'quantity'].every(kind => numericKind(kind as never))).toBe(true)
    expect(numericKind('flag')).toBe(false)
    expect(numericKind(undefined)).toBe(false)
  })
})

describe('answer names', () => {
  it('recognises transaction names including acronym-led ones, not flags, fields or standard numbers', () => {
    expect(answerNames('transaction', 'GRPSet makes it; WidgetCreate, NFTokenMint, tfSplitFill, tesSUCCESS, TakerLimit and XLS-77 are different things.', 'q')).toEqual(['GRPSet', 'WidgetCreate', 'NFTokenMint'])
  })
  it('recognises flag, header, standard, numbered, law, share, quantity and code shapes', () => {
    expect(answerNames('flag', 'Set tfSplitFill or lsfRequireWidget; OPT_FROB also works.', 'q')).toEqual(['tfSplitFill', 'lsfRequireWidget', 'OPT_FROB'])
    expect(answerNames('header', 'It sends RECEIPT-PROOF and X-RECEIPT-ID, under XLS-77.', 'q')).toEqual(['RECEIPT-PROOF', 'X-RECEIPT-ID'])
    expect(answerNames('standard', 'XLS-77 defines WidgetPool.', 'q')).toEqual(['XLS-77', 'WidgetPool'])
    expect(answerNames('numbered', 'See Recommendation 7 and Article 12.', 'q')).toEqual(['Recommendation 7', 'Article 12'])
    expect(answerNames('law', 'The Frobnication Act and the Widget Trading Law apply.', 'q')).toEqual(['The Frobnication Act', 'Widget Trading Law'])
    expect(answerNames('share', 'At least 63% agree; 40 percent do not.', 'q')).toEqual(['63%', '40 percent'])
    expect(answerNames('quantity', 'It costs 12 drops, or 3 business days, plus 1.5 XRP.', 'q')).toEqual(['12 drops', '3 business days', '1.5 XRP'])
    expect(answerNames('code', 'The code is 5A4F4F4D31 and not USD.', 'q')).toEqual(['5A4F4F4D31', 'USD'])
  })
  it('never offers a name the question already contains', () => {
    expect(answerNames('transaction', 'WidgetCreate and GRPSet differ.', 'Which transaction is not WidgetCreate?')).toEqual(['GRPSet'])
  })
  it('does not read an ordinary number, plain word or lowercase phrase as a code or quantity', () => {
    expect(answerNames('quantity', 'Take 2 of the three options and 5 apples.', 'q')).toEqual([])
    expect(answerNames('transaction', 'the ordinary words and Title Case Phrase', 'q')).toEqual([])
  })
})

describe('lead sentence for a which/what question', () => {
  it('prefers the sentence naming a transaction (even acronym-led) over a standard description', () => {
    const sentences = lead('Which transaction type sets or updates a widget group on the ledger?',
      'An XLS-77 widget group on the ledger identifies a controller and supports verifiable associations.',
      'The GRPSet transaction sets or updates a widget group on the ledger.')
    expect(sentences[0]).toBe('The GRPSet transaction sets or updates a widget group on the ledger.')
  })

  it('prefers the sentence naming the header over one that only describes the flow', () => {
    const sentences = lead('Which HTTP header carries the receipt for a purchase?',
      'The HTTP client checks the receipt for a purchase after the server responds.',
      'The HTTP header X-RECEIPT-PROOF carries the receipt for a purchase.')
    expect(sentences[0]).toBe('The HTTP header X-RECEIPT-PROOF carries the receipt for a purchase.')
  })

  it('prefers the percentage when asked for a share', () => {
    const sentences = lead('What share of members must approve a change before it is adopted?',
      'Members discuss each change at length before it is adopted by the council.',
      'At least 75% of members must approve a change.')
    expect(sentences[0]).toBe('At least 75% of members must approve a change.')
  })

  it('does not let a sentence about another topic lead a share question', () => {
    expect(lead('What share of members must approve a change before it is adopted?',
      'A sidechain is a separate ledger with its own rules and consensus.')).toEqual([])
  })

  it('does not let a number-free sentence lead a quantity question with little overlap', () => {
    expect(lead('What is the maximum number of widgets one account can hold?',
      'A sidechain is a separate ledger with its own rules and consensus.')).toEqual([])
  })

  it('still shows a topical sentence when nothing names the asked thing', () => {
    expect(lead('Which flag makes the transfer immediate?',
      'Flags select behaviours such as immediate execution of the transfer.')).toEqual(['Flags select behaviours such as immediate execution of the transfer.'])
  })

  it('applies no answer-shape floor to an explanatory question', () => {
    expect(lead('How does the broker verify a payment before settling the transaction?',
      'The broker must verify the payment before settling the transaction.')).toEqual(['The broker must verify the payment before settling the transaction.'])
  })

  it('weights a question term by how rare it is among the candidate sentences', () => {
    const ranked = rankLeadSentences('What does the arbiter do with the ledger?', [
      claim('a', 'The ledger holds every ledger entry.', 'one'),
      claim('b', 'The ledger stays public, and the ledger stays shared.', 'two'),
      claim('c', 'The ledger orders entries, and the ledger seals them.', 'three'),
      claim('d', 'The arbiter resolves each dispute.', 'four'),
    ])
    const weighted = (text: string) => ranked.find(item => item.text === text)!.weighted
    // "arbiter" is in one sentence and "ledger" in three, so covering it says more.
    expect(weighted('The arbiter resolves each dispute.')).toBeGreaterThan(weighted('The ledger holds every ledger entry.'))
    expect(ranked[0].text).toBe('The arbiter resolves each dispute.')
  })

  it('demotes a template repeated across articles and never uses it as the complement', () => {
    const template = 'Account names the sender; fees, signing and sequence rules still apply to every request.'
    const selected = leadFinding('Which transaction type creates a widget pool?', [
      claim('a', 'PoolCreate builds a new widget pool from two assets.', 'tx-create'),
      claim('b', template, 'tx-create'),
      claim('c', template, 'tx-delete'),
      claim('d', 'PoolDelete removes a widget pool.', 'tx-delete'),
    ]).map(item => item.text)
    expect(selected[0]).toBe('PoolCreate builds a new widget pool from two assets.')
    expect(selected).not.toContain(template)
    const ranked = rankLeadSentences('Which transaction type creates a widget pool?', [claim('b', template, 'tx-create'), claim('c', template, 'tx-delete')])
    expect(ranked.every(item => item.shared)).toBe(true)
  })

  it('treats a bare camelCase-looking identifier of the wrong kind as weaker than the asked kind', () => {
    // A standard number is not a transaction name even though it looks like an identifier.
    const ranked = rankLeadSentences('Which transaction type removes a widget group?', [
      claim('a', 'XLS-77 explains how a widget group is removed from the registry.'),
      claim('b', 'GRPDelete removes a widget group.'),
    ])
    expect(ranked[0].text).toBe('GRPDelete removes a widget group.')
    expect(ranked[0].named).toBe(true)
  })
})

describe('answer context obeys the same floor', () => {
  const base = { title: 'Council rules', facets: ['council', 'approval'] }
  const texts = [
    'At least 75% of members must approve a change before the council adopts it.',
    'A sidechain is a separate ledger with its own rules and consensus about approval.',
  ]
  const content = { ...exampleContent, title: base.title, body: texts.join(' '), spans: texts.map((text, i) => ({ id: `p${i}`, text })) }
  const candidate = { ...exampleCandidate, ...base }

  it('keeps an unrelated sentence out of the context paragraph, not only out of the lead', () => {
    const answer = summarizeAnswer('What share of members must approve a change before the council adopts it?', exampleAnswer, [content], [candidate])
    expect(answer.lead?.map(item => item.text)).toEqual([texts[0]])
    expect(answer.conclusion).not.toContain('sidechain')
  })

  it('says there is nothing to lead with, rather than printing the unrelated sentence', () => {
    const lonely = { ...content, body: texts[1], spans: [{ id: 'p0', text: texts[1] }] }
    const answer = summarizeAnswer('What share of members must approve a change before the council adopts it?', exampleAnswer, [lonely], [candidate])
    expect(answer.lead).toEqual([])
    expect(answer.conclusion).not.toContain('sidechain')
  })

  it('applies the floor to a sentence on its own', () => {
    expect(onTopicSentence('What share of members must approve a change?', texts[0])).toBe(true)
    expect(onTopicSentence('What share of members must approve a change?', texts[1])).toBe(false)
    expect(onTopicSentence('How do members approve a change?', texts[1])).toBe(true)
  })
})
