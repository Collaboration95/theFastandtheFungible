import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { topicMatches } from '../shared/relevance.js'
import { ABOUT, ABOUT_LABEL, REDIRECT, REDIRECT_LABEL, fixturePlan, needsResearch, scope } from '../server/agents/scope.js'
import { liveQuestion, runLiveShaped, type LiveQuestion, type LiveShapedResult } from './fixtures/r9-live-shaped.js'

// R9-C (round-9 mock judges, notes/review-nov10/13-mock-judges-r9.md §5.2 PR-C): the product answers questions about
// itself. B5, C1 and C4 are the judges' own product questions (F1 repeats C4); D4 is R9-A's handed-over repro. Each is
// replayed with the fixture planner's plan and with both live plans the judges recorded (the modal plan the visitor
// confirmed and the plan the hosted run re-planned), with fixture decisions and SIMULATED payments. Regression data on
// questions already seen, never a held-out result.

const B5 = liveQuestion('B5').question
const C1 = liveQuestion('C1').question
const C4 = liveQuestion('C4').question
const D4 = liveQuestion('D4').question
const article = (id: string) => JSON.parse(readFileSync(`data/corpus/v2/articles/team-xrpl-explainers/${id}.json`, 'utf8')) as { title: string; tags: string[]; passages: { id: string; text: string }[] }
const doc = (id: string, passage?: string) => { const a = article(id); return `${a.title} ${a.tags.join(' ')} ${passage ?? a.passages.map(p => p.text).join(' ')}` }

/** The fixture planner's own wording: its plan, and no planner facts (the run freezes the fixture extraction). */
const fixtureWorded = (q: LiveQuestion): LiveQuestion => { const plan = { ...fixturePlan(q.question), requirements: [] }; return { ...q, modal: plan, run: plan } }

describe('R9-C: product questions buy one product explainer and lead with the answer', () => {
  const expected: Record<string, { article: string; lead: RegExp }> = {
    B5: { article: 'product-how-it-decides', lead: /^ResearchAgent decides which article is worth buying in two steps: a decision model scores/ },
    C1: { article: 'product-writer-paid', lead: /^the writer gets paid by publishing the article's key on the XRP Ledger/ },
    C4: { article: 'product-writer-earnings', lead: /^a writer earns the full price they set per sale, S\$0\.40 .*ResearchAgent takes no fee per article sale\.$/ },
    F1: { article: 'product-writer-earnings', lead: /^a writer earns the full price they set per sale/ },
  }
  let results: (LiveShapedResult & { planner: string })[] = []
  beforeAll(async () => {
    vi.stubEnv('SEARCH_EMBEDDINGS', 'off')
    const questions = [...Object.keys(expected), 'D4'].map(liveQuestion)
    results = [
      ...(await runLiveShaped(questions, 'modal')).map(r => ({ ...r, planner: 'live modal' })),
      ...(await runLiveShaped(questions, 'run')).map(r => ({ ...r, planner: 'live run' })),
      ...(await runLiveShaped(questions.map(fixtureWorded), 'modal')).map(r => ({ ...r, planner: 'fixture' })),
    ]
  }, 240_000)
  afterAll(() => { vi.unstubAllEnvs() })
  for (const planner of ['fixture', 'live modal', 'live run']) {
    it(`${planner} plan: B5, C1, C4 and F1 each buy exactly their product explainer, once, and lead with its answer`, () => {
      for (const [id, want] of Object.entries(expected)) {
        const r = results.find(x => x.id === id && x.planner === planner)!
        expect(r.phase, `${id} ${planner}`).toBe('DONE')
        expect(r.bought, `${id} ${planner}`).toEqual([want.article])
        expect(r.spentMinor, `${id} ${planner}`).toBe(40)
        expect(r.lead[0], `${id} ${planner}`).toMatch(want.lead)
      }
    })
    it(`${planner} plan: D4 (the writer never reveals the key) buys the no-show article and has a lead`, () => {
      const r = results.find(x => x.id === 'D4' && x.planner === planner)!
      expect(r.bought).toEqual(['product-escrow-no-show'])
      expect(r.lead[0]).toMatch(/EscrowCancel|cancellation/)
    })
  }
  it('the earnings answer closes both requested facts: "Still unanswered" lists neither', () => {
    for (const r of results.filter(x => x.id === 'C4' || x.id === 'F1')) expect(r.openGaps, `${r.id} ${r.planner}`).toEqual([])
  })
})

describe('R9-C topic rules: the bought product article is on the question\'s topic', () => {
  it('C1: "get paid" and "refusing to pay" match an article about payment (pay, paid and payment are one word here)', () => {
    // Round 9 (R9-B's finding): the decision step admitted product-key-reveal-trust on the fact "How the writer gets paid
    // for the article", then the answer's guard rejected it against the whole question, so the run paid with no answer.
    expect(topicMatches(C1, doc('product-key-reveal-trust'))).toBe(true)
    for (const p of article('product-key-reveal-trust').passages) expect(topicMatches(C1, doc('product-key-reveal-trust', p.text)), p.id).toBe(true)
    expect(topicMatches('How the writer gets paid for the article', doc('product-key-reveal-trust'))).toBe(true)
  })
  it('D4 run wording: "final or reversible" is what the fact asks about its subject, not a finality article it needs', () => {
    const fact = liveQuestion('D4').run.requirements[0]
    expect(fact).toMatch(/^Whether a payment .* is final or reversible/)
    for (const p of article('product-escrow-no-show').passages) expect(topicMatches(fact, doc('product-escrow-no-show', p.text)), p.id).toBe(true)
  })
  it('a broad family stays the gate when the rest of the question is not matched', () => {
    // At least two, and half, of the other subject words are needed.
    expect(topicMatches('How long does an XRPL payment take to become final?', 'What does an XRPL Credential prove? credentials CredentialCreate')).toBe(false)
    expect(topicMatches('Is a payment final when the writer never reveals the key?', 'Writer payout schedule for newsletters')).toBe(false)
    // H8-01 unchanged: a Testnet server list never answers an x402 question.
    expect(topicMatches('What does an x402 402 response contain, and can my agent pay it with XRP on Testnet?', 'Which public XRPL Testnet servers can an agent use? testnet websocket endpoint')).toBe(false)
    // A specific family keeps its gate: an escrow fact needs escrow vocabulary, however many other words match.
    expect(topicMatches('Whether an XRPL escrow can be cancelled when the writer never reveals the key', 'How does the writer get paid when the key is never revealed? writer payment')).toBe(false)
  })
  it('folding is local to the subject floor: an unrelated finance question is still off topic', () => {
    expect(topicMatches('How does the writer get paid?', 'Singapore home loans: the silent rate sensitivity killer')).toBe(false)
    expect(topicMatches('What did the BoJ change at its last meeting?', doc('product-writer-paid'))).toBe(false)
  })
})

describe('R9-C H9-11: off-topic chat gets one line pointing back to what ResearchAgent researches', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
  const live = (value: unknown) => {
    vi.stubEnv('LLM_PROVIDER', 'deepseek'); vi.stubEnv('DEEPSEEK_API_KEY', 'test-only')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(value) } }] })}\n\ndata: [DONE]\n\n`)))
  }
  it('is one sentence plus one suggestion, in plain words, labelled as fixed', () => {
    expect(REDIRECT.split(/(?<=\.)\s+/)).toHaveLength(2)
    expect(REDIRECT).toMatch(/^I only research XRPL, x402 and agent payments/)
    expect(REDIRECT_LABEL).toMatch(/^fixed · /)
  })
  it.each([
    ["What's a good recipe for Hainanese chicken rice?", 'Poach a whole chicken with ginger and scallions, then cook the rice in the stock with garlic and pandan…'],
    ['Who won the 2026 Singapore Grand Prix?', "I can't check current events or race results here."],
    ['How big is the Sun?', "The Sun is about 1.39 million km across, roughly 109 times Earth's diameter."],
    ['Can you help me write a haiku?', 'Leaves fall slowly / the ledger closes again / autumn settles in'],
  ])('%s → the redirect, whatever the model wrote', async (question, reply) => {
    expect(needsResearch(question)).toBe(false)
    live({ route: 'chat', reply })
    expect(await scope(question)).toMatchObject({ questions: [], chat: { reply: REDIRECT }, label: REDIRECT_LABEL })
  })
  it.each(['hi', 'Hello there!', 'thanks!', 'thank you so much', 'ok 👍', 'bye'])('small talk "%s" keeps the model\'s short reply', async question => {
    live({ route: 'chat', reply: 'Hi! Ask me about XRPL, x402 or agent payments.' })
    expect(await scope(question)).toMatchObject({ chat: { reply: 'Hi! Ask me about XRPL, x402 or agent payments.' }, label: 'DeepSeek · deepseek-flash' })
  })
  it('keeps the fixed "What are you?" statement and sends product questions to research', async () => {
    live({ route: 'chat', reply: 'I buy articles whenever I like.' })
    expect(await scope('What are you?')).toMatchObject({ chat: { reply: ABOUT }, label: ABOUT_LABEL })
    for (const question of [B5, C1, C4, D4]) {
      live({ route: 'chat', reply: REDIRECT })
      expect(needsResearch(question), question).toBe(true)
      expect((await scope(question)).chat, question).toBeUndefined()
    }
  })
})
