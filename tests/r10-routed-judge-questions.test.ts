import { readFileSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { fixtureCoverage } from '../server/agents/requirements.js'
import { leadFinding } from '../shared/lead-finding.js'
import { subjectFamilies } from '../shared/relevance.js'
import { runLiveShaped, type LiveQuestion, type LiveShapedResult } from './fixtures/r9-live-shaped.js'

// Six fresh local live plans, then question paraphrases with those plans retained.
// These are used development cases, not MJ10's deleted raw sessions or a blind bank.
const recorded: LiveQuestion[] = JSON.parse(readFileSync('tests/fixtures/r10-routed-plans.json', 'utf8')).questions
const recordedAfter: LiveQuestion[] = JSON.parse(readFileSync('tests/fixtures/r10-routed-after-plans.json', 'utf8')).questions
const rlusd: LiveQuestion = JSON.parse(readFileSync('tests/fixtures/r10-live-plans.json', 'utf8')).questions.find((q: LiveQuestion) => q.id === 'XRPL1-1')
const rlusdWordings = [rlusd.question, 'Can RLUSD be locked in an XRPL escrow now, and which issuer flag is needed?', 'What issuer permission does RLUSD need for token escrow on XRPL?']
const wordings: Record<string, string[]> = {
  reserves: [recorded[0].question, 'What XRP base reserve and per-object increment does an XRPL wallet need for escrows and trust lines?', 'How much XRP must an account reserve, including each escrow and trust line?'],
  credentials: [recorded[1].question, 'What do XRPL Credentials attest to, and which transactions issue and accept them?', 'Explain what an XRPL Credential means, how it is created and how the subject accepts it.'],
  x402: [recorded[2].question, 'Which payment terms are in an x402 response, and can I pay with XRP on Testnet?', 'Explain the x402 402 challenge and whether an agent can settle it in XRP on XRPL Testnet.'],
  injection: [recorded[3].question, 'How do spending controls stop prompt injection from draining an agent wallet?', 'What prevents malicious article instructions making an AI agent overspend its wallet?'],
  submitters: [recorded[4].question, 'How do EscrowFinish and EscrowCancel differ, and which accounts may submit them?', 'Compare EscrowFinish with EscrowCancel and explain who is allowed to submit each.'],
  'no-show': [recorded[5].question, 'How can a buyer recover money if an article writer never reveals the key?', 'What happens to locked payment when the writer fails to deliver the decryption key?'],
}
const questions = [...recorded.flatMap(q => wordings[q.id].map((question, i) => ({ ...q, id: `${q.id}-${i}`, question, requirementsBy: i ? 'fixture paraphrase · recorded plan retained' : 'DeepSeek · deepseek-flash (recorded)' }))), ...rlusdWordings.map((question, i) => ({ ...rlusd, id: `rlusd-${i}`, question, requirementsBy: i ? 'fixture paraphrase · recorded plan retained' : 'DeepSeek · deepseek-flash (recorded)' })), ...recordedAfter]
let results: LiveShapedResult[]
beforeAll(async () => {
  vi.stubEnv('SEARCH_EMBEDDINGS', 'off')
  results = await runLiveShaped(questions)
  if (process.env.QUAL_ROUTED_OUTPUT) writeFileSync(process.env.QUAL_ROUTED_OUTPUT, JSON.stringify(results, null, 2) + '\n')
}, 120_000)
afterAll(() => vi.unstubAllEnvs())

const checkAgreement = (r: LiveShapedResult) => {
  const supported = r.coverage?.entries.filter(e => e.status === 'supported').length ?? 0
  expect(r.facts?.answered, `${r.id}: display versus stored coverage`).toBe(supported)
  expect(r.coverageEvent?.answered, `${r.id}: trace versus stored coverage`).toBe(supported)
  for (const entry of r.coverage?.entries ?? []) {
    const text = r.requirements?.find(f => f.id === entry.requirementId)?.text
    if (entry.status === 'supported') expect(r.openGaps).not.toContain(text)
    else expect(r.openGaps).toContain(text)
  }
}

describe('round-10 routed questions, three wordings each', () => {
  it.each(wordings.reserves)('H10-01 reserves answers the increments without redundant buys: %s', question => {
    const r = results.find(r => r.question === question)!
    expect(r.bought).toEqual(['xrpl-reserves']); expect(r.spentMinor).toBe(40)
    expect(r.lead.join(' ')).toMatch(/1 XRP.*0\.2 XRP/)
    expect(r.conclusion).toMatch(/Mainnet|Testnet/); checkAgreement(r)
  })
  it.each(wordings.credentials)('H10-02 creation, acceptance and meaning have their own support: %s', question => {
    const r = results.find(r => r.question === question)!
    expect(r.conclusion).toContain('CredentialCreate'); expect(r.conclusion).toContain('CredentialAccept')
    // The route explicitly permits an honest remaining meaning gap; a transaction reference cannot imply it.
    if (!/attest|issuer.*subject|subject.*issuer/i.test(r.conclusion)) expect(r.openGaps).toContain(recorded[1].modal.requirements[0])
    checkAgreement(r)
  })
  it.each(wordings.x402)('H10-03 x402 answers XRP and Testnet with its header: %s', question => {
    const r = results.find(r => r.question === question)!
    expect(r.bought).toEqual(['product-x402-response'])
    expect(r.lead[0]).toContain('PAYMENT-REQUIRED'); expect(r.lead.join(' ')).toMatch(/XRP.*Testnet/)
    checkAgreement(r)
  })
  it.each(wordings.injection)('H10-04 the direct spending-authority answer leads: %s', question => {
    const r = results.find(r => r.question === question)!
    expect(r.lead.join(' ')).toMatch(/budget|policy/)
    expect(r.lead.join(' ')).toMatch(/cannot sign|only authorization|only.*policy/i)
    checkAgreement(r)
  })
  it.each(wordings.submitters)('H10-05 names eligible submitters separately from recipients: %s', question => {
    const r = results.find(r => r.question === question)!
    expect(r.lead.join(' ')).toMatch(/Any account may submit EscrowFinish or EscrowCancel/)
    expect(r.lead.join(' ')).toMatch(/destination.*owner/)
    checkAgreement(r)
  })
  it.each(wordings['no-show'])('H10-07 no-show recovery has a useful lead and consistent coverage: %s', question => {
    const r = results.find(r => r.question === question)!
    expect(r.lead.join(' ')).toMatch(/EscrowCancel.*CancelAfter|CancelAfter.*EscrowCancel/)
    expect(r.facts?.answered).toBeGreaterThan(0)
    checkAgreement(r)
  })
  it.each(rlusdWordings)('H10-07 RLUSD issuer support is counted consistently: %s', question => {
    const r = results.find(r => r.question === question)!
    expect(r.lead.join(' ')).toContain('AllowTrustLineLocking')
    expect(r.facts?.answered).toBeGreaterThan(0)
    checkAgreement(r)
  })
  it('keeps the recorded search plan unchanged', () => {
    for (const r of results) {
      const q = questions.find(q => q.id === r.id)!
      const { requirements: _requirements, ...plan } = q.modal
      expect(r.plan).toEqual(plan)
    }
  })
  it('preserves purchases and coverage agreement on all ten fresh after plans', () => {
    for (const q of recordedAfter) {
      const r = results.find(r => r.id === q.id)!
      expect(r.bought, q.id).toEqual(q.observed.bought)
      expect(r.spentMinor, q.id).toBe(q.observed.spentMinor)
      expect(r.lead.length, q.id).toBeGreaterThan(0)
      checkAgreement(r)
    }
  })
})

const before: { evidence: { text: string }[] }[] = JSON.parse(readFileSync('docs/evidence/qual/r10-routed-before.json', 'utf8'))
it.each(['Which XRPL transaction creates a Credential', 'What transaction issues an XRPL Credential?', 'Name the transaction that establishes a new Credential'])('the saved acceptance-only answer cannot establish creation: %s', text => {
  expect(fixtureCoverage([{ id: 'creation', text }], before[1].evidence.map((e, i) => ({ ref: String(i), text: e.text })))).toEqual({ creation: 'missing' })
})
it.each(['What an XRPL Credential proves', 'What XRPL Credentials attest to', 'What a Credential means and who makes the assertion'])('the saved acceptance-only answer cannot establish meaning: %s', text => {
  expect(fixtureCoverage([{ id: 'meaning', text }], before[1].evidence.map((e, i) => ({ ref: String(i), text: e.text })))).toEqual({ meaning: 'missing' })
})
it('does not remove the empty-lead state when the delivered claims lack an answer', () => {
  expect(leadFinding(wordings.injection[0], [], [])).toEqual([])
})
it.each(['malicious Credential instructions', 'untrusted credential content'])('safety vocabulary retains the original named subject: %s', text => {
  expect(subjectFamilies(text).map(family => family[0])).toEqual(expect.arrayContaining(['credential', 'prompt injection']))
})
it.each(['Who can submit EscrowCancel?', 'Which accounts may submit EscrowCancel?', 'Eligible submitters for EscrowCancel'])('a different transaction or recipient cannot establish submitter eligibility: %s', text => {
  for (const passage of ['Any account may submit EscrowFinish. [1]', 'EscrowCancel returns principal to the owner. [1]']) {
    expect(fixtureCoverage([{ id: 'role', text }], [{ ref: 'p1', text: passage }])).toEqual({ role: 'missing' })
  }
})
it.each(['Whether RLUSD supports escrow on 1 January 2027', 'RLUSD issuer permission as of 2027', 'The TokenEscrow activation date in 2027'])('retains an unsupported date instead of borrowing an unrelated figure: %s', text => {
  expect(fixtureCoverage([{ id: 'dated', text }], [{ ref: 'p1', text: 'RLUSD requires AllowTrustLineLocking; the issuer had not enabled it on 11 November 2026.' }])).toEqual({ dated: 'missing' })
})
it.each(['The TokenEscrow activation date', 'When TokenEscrow was activated in 2026', 'When the issuer enabled token escrow in 2026'])('a dated status observation is not an activation date: %s', text => {
  expect(fixtureCoverage([{ id: 'dated', text }], [{ ref: 'p1', text: 'TokenEscrow requires AllowTrustLineLocking. The issuer had not enabled it on 11 November 2026.' }])).toEqual({ dated: 'missing' })
})
it.each(['RLUSD issuer permission as of 12 November 2026', 'RLUSD issuer permission as of 2026-11-12', 'RLUSD issuer permission on November 12, 2026'])('a different day in the same year stays missing: %s', text => {
  expect(fixtureCoverage([{ id: 'dated', text }], [{ ref: 'p1', text: 'RLUSD requires AllowTrustLineLocking; the issuer had not enabled it on 11 November 2026.' }])).toEqual({ dated: 'missing' })
})
it.each(['What XRPL Credentials attest to', 'What an XRPL Credential proves', 'What a Credential means and who makes the assertion'])('a negated attestation cannot establish Credential meaning: %s', text => {
  expect(fixtureCoverage([{ id: 'meaning', text }], [{ ref: 'p1', text: 'An XRPL Credential does not attest to any verified issuer assertion.' }])).toEqual({ meaning: 'missing' })
})
it('recognizes an explicit matching date across calendar formats', () => {
  expect(fixtureCoverage([{ id: 'dated', text: 'RLUSD issuer permission as of 2026-11-11' }], [{ ref: 'p1', text: 'RLUSD requires AllowTrustLineLocking; the issuer had not enabled it on 11 November 2026.' }])).toEqual({ dated: 'supported' })
})
