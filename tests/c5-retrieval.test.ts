import { describe, expect, it } from 'vitest'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { buildIndex, searchIndex } from '../publisher/search.js'
import { keywordCoverage, searchWords } from '../publisher/search-text.js'
import { expandProtocolQuery, isProtocolQuery, topicMatches } from '../shared/relevance.js'
import { fixturePlan } from '../server/agents/scope.js'

// C5 retrieval: glossary vocabulary for the new sourced explainers, host fragments that are not words, and
// capitalised acronyms that spell a stop word. Questions are written for these tests; none is from a judge bank.

describe('glossary vocabulary added with the C5 explainers', () => {
  it.each([
    ['What does a crypto condition on an escrow look like?', 'PREIMAGE-SHA-256'],
    ['How many TicketSequence values can an account use?', 'TicketCreate'],
    ['Where is the negative UNL used?', 'validation threshold'],
    ['Does tfFillOrKill leave anything on the book?', 'tfImmediateOrCancel'],
    ['What is SendMax for?', 'DeliverMax'],
    ['Which stablecoin framework applies?', 'GENIUS Act'],
    ['What is the Agent Payments Protocol?', 'AP2'],
    ['What does a facilitator do?', 'verify and settle'],
    ['What is DepositPreauth?', 'deposit authorization'],
    ['Which Testnet server should I use?', 'altnet'],
    ['Which field holds the DID document?', 'DIDSet'],
  ])('expands %s', (question, alias) => {
    expect(expandProtocolQuery(question)).toContain(alias)
  })

  it.each([
    'How do I fix a leaking faucet?',
    'Who won the 2026 Singapore Grand Prix?',
    'What is the central bank mandate on inflation?',
    'How much is a concert ticket for the final?',
    'What is the trading fee at my broker?',
    'Can I make a partial payment on my credit card?',
    'What is the currency code for the yen?',
  ])('does not treat %s as an XRPL question or borrow C5 vocabulary', question => {
    expect(isProtocolQuery(question)).toBe(false)
    const added = ['PREIMAGE-SHA-256', 'TicketCreate', 'tfFillOrKill', 'DeliverMax', 'GENIUS Act', 'AP2', 'DepositPreauth', 'altnet', 'LP token', 'DIDDocument']
    for (const name of added) expect(expandProtocolQuery(question)).not.toContain(name)
  })

  it('still ties an alias to its subject without accepting a finance story', () => {
    expect(topicMatches('Which crypto-condition type does an XRPL escrow use?', 'XRPL escrow PREIMAGE-SHA-256 fulfillment')).toBe(true)
    expect(topicMatches('Which crypto-condition type does an XRPL escrow use?', 'Singapore corporate bond yields and the yen')).toBe(false)
  })
})

describe('keyword words', () => {
  it('reads a host as its labels, never as the generic words net or org', () => {
    const words = searchWords('wss://s.altnet.rippletest.net:51233/ and https://xrpl.org/docs')
    expect(words).toContain('altnet')
    expect(words).toContain('rippletest')
    expect(words).toContain('xrpl')
    expect(words).not.toContain('net')
    expect(words).not.toContain('org')
    expect([...searchWords("What is Taylor Swift's net worth?")]).toContain('net')
  })

  it('does not let a URL fragment satisfy half of an unrelated question', () => {
    const document = searchWords('Testnet public server wss://s.altnet.rippletest.net:51233/ for the XRP Ledger')
    expect(keywordCoverage("What is Taylor Swift's net worth?", document)).toBeLessThan(0.5)
  })
})

describe('fixture plan keeps an acronym that spells a stop word', () => {
  it('keeps DID, drops the verb did', () => {
    expect(fixturePlan('Which field of an XRPL DID ledger entry holds the DID document?').subqueries[0]).toContain('DID')
    expect(fixturePlan('What did the central bank change in September?').subqueries[0]).not.toMatch(/\bdid\b/i)
    expect(fixturePlan('WHAT DID THE CENTRAL BANK CHANGE').subqueries[0]).not.toMatch(/\bdid\b/i)
  })
})

describe('the new explainers are found by questions a judge would type', () => {
  it.each([
    ['Which crypto-condition type does XRPL conditional escrow support?', 'c5-xrpl-crypto-condition-type'],
    ['How many Tickets can one XRPL account hold at once?', 'c5-xrpl-ticket-limit'],
    ['What is the maximum trading fee an AMM can set on XRPL?', 'c5-xrpl-amm-create-deposit'],
    ['Which OfferCreate flag makes an order fill or kill?', 'c5-offercreate-flags'],
    ['What is the RLUSD currency code in hexadecimal?', 'c5-rlusd-currency-code'],
    ['What are the public server URLs for XRPL Testnet?', 'c5-xrpl-testnet-servers'],
    ['What do an x402 facilitator verify and settle calls do?', 'c5-x402-facilitator-verify-settle'],
    ['What does the GENIUS Act require of stablecoin issuers?', 'c5-us-genius-act-requirements'],
    ['Does a Singapore company need a MAS licence to pay suppliers in RLUSD?', 'c5-mas-licence-paying-suppliers-rlusd'],
  ])('%s → %s in the first five', async (question, articleId) => {
    const corpus = await loadWriterCorpus()
    const index = await buildIndex(corpus.articles.filter(a => a.publisherSlug === 'team-xrpl-explainers'))
    const { ranked } = await searchIndex(index, question, 5)
    expect(ranked.map(hit => hit.articleId)).toContain(articleId)
  })

  it('returns nothing from the XRPL writer for a question about a celebrity', async () => {
    const corpus = await loadWriterCorpus()
    const index = await buildIndex(corpus.articles.filter(a => a.publisherSlug === 'team-xrpl-explainers'))
    for (const question of ["What is Taylor Swift's net worth?", 'What is a recipe for Hainanese chicken rice?', 'How do I fix a leaking faucet?']) {
      expect((await searchIndex(index, question, 5)).ranked, question).toEqual([])
    }
  })
})
