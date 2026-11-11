// The judge pack tells one true story (README, docs/submission, the site's hand-written pages).
// These checks do not depend on which release is latest, so they hold before and after a publish:
// no old release is named as current, the writer and held-out wording match the data, and no private
// review notes or scores appear in a public file. The numbers themselves come from facts.json (deck.test.ts).
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const read = (path: string) => readFileSync(path, 'utf8')
/** Every file under a folder whose name matches, sorted. */
const walk = (dir: string, match: RegExp): string[] =>
  readdirSync(dir).sort().flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path, match) : match.test(name) ? [path] : []
  })

const submission = walk('docs/submission', /\.(md|html|json|txt|srt|csv)$/).filter(f => !f.includes('/deck/assets/'))
// Hand-written site pages. /progress/ and /evolution/ are generated from history and may name old releases.
const sitePages = ['index.html', 'developers/index.html', 'builder-feedback/index.html', 'proof/index.html', 'talk/index.html', 'ledger/index.html'].map(p => `site/${p}`)
const publicFiles = ['README.md', ...submission, ...sitePages]

// #482 made a Testnet Permissioned Domain real. Qualifiers must be local to
// each claim, including across wrapped prose and SRT cue boundaries.
const domainWindow = 200
function domainClaimViolations(text: string): number[] {
  const hits: number[] = []
  for (const match of text.matchAll(/Permissioned Domains?/gi)) {
    const at = match.index!
    if (/\b(?:no|without|do not use|does not use)\s*$/i.test(text.slice(Math.max(0, at - 40), at))) continue
    const nearby = text.slice(Math.max(0, at - domainWindow), at + match[0].length + domainWindow)
    const qualified = /\b(?:Testnet|operator[- ]issued|identity only)\b/i.test(nearby)
    const affirmative = nearby
      .replace(/\b(?:not|no|without)\s+(?:(?:on|a)\s+)?(?:Mainnet|KYC)\b/gi, '')
      .replace(/\bMainnet\s+(?:spending\s+)?(?:(?:is|remains)\s+)?(?:disabled|unsupported|unavailable)\b/gi, '')
    if (!qualified || /\b(?:Mainnet|KYC(?:'d)?)\b/i.test(affirmative)) hits.push(at)
  }
  return hits
}

describe('judge pack: one true story', () => {
  it('names no old release as current (v1.0.x appears only to say it cannot verify new exports)', () => {
    const found: string[] = []
    for (const file of publicFiles) {
      const text = file.endsWith('facts.json') ? '' : read(file) // facts.json is checked against the latest published release by `npm run hygiene`
      for (const line of text.split('\n')) {
        for (const match of line.matchAll(/\bv?1\.0\.[0-9]+\b/g)) if (!/cannot recompute|v1\.0\.2 wheel/.test(line)) found.push(`${file}: ${match[0]}`)
      }
    }
    expect(found).toEqual([])
  })

  it('keeps private review notes and scores out of public files', () => {
    const leaks: string[] = []
    for (const file of publicFiles) {
      for (const [i, line] of read(file).split('\n').entries()) {
        if (/\bmock[- ]judges?\b|\bH[0-9]-[0-9]{2}\b|\b[0-9]{2}(?:\.[0-9]+)? ?\/ ?105\b/i.test(line)) leaks.push(`${file}:${i + 1}`)
      }
    }
    expect(leaks).toEqual([])
  })

  it('keeps the overclaims the story review found out of every public surface, video words included', () => {
    const retired: [RegExp, string][] = [
      [/A model recommends/i, 'the live sandbox buys by fixed rules: no model recommends there'],
      [/\ban open market\b/i, 'there are no independent writers yet'],
      [/keeps (?:everyone|them) honest/i, 'the ledger enforces delivery, not quality'],
      [/Every claim has a Testnet hash/i, 'every payment has one; the quality numbers used simulated payments'],
      [/two independent (?:receipt )?verifiers/i, 'one team wrote both, separately'],
      [/verifier that isn.t ours/i, 'both verifiers are ours'],
      [/buys only the articles that fill the gap/i, 'it buys an article only when policy judges it fills a gap'],
      [/seven of twenty/i, 'that was the v4 bank; v5 is sixteen of twenty (use the fact markers)'],
    ]
    const hits: string[] = []
    for (const file of publicFiles) {
      const text = read(file)
      for (const [pattern, why] of retired) if (pattern.test(text)) hits.push(`${file}: ${pattern} (${why})`)
    }
    expect(hits).toEqual([])
    // The video words live in shots.json (the source) and are copied into the generated files; they must agree.
    const spec = JSON.parse(read('docs/submission/video/shots.json')) as { shots: { id: string; vo: string }[] }
    const voiceover = read('docs/submission/video/voiceover.txt')
    for (const shot of spec.shots) if (shot.vo) expect(voiceover, shot.id).toContain(shot.vo)
  })

  it('claims no XRPL feature we do not use or that is not available on the network', () => {
    // XRPL review: not used, or not available on Testnet or Mainnet. Saying we have none of them is fine.
    const did = /\bDIDs?\b/ // The acronym is case-sensitive; prose such as 'Did I get paid?' is not a feature claim.
    const never = /\bMPTs?\b|XLS-56|Batch (?:transaction|amendment)|payment channels?|PayChan|mainnet[- ]ready|KYC'?d|smart[- ]contract/i
    const denial = /\bno (?:smart )?contract|\bwithout (?:a )?smart contract|no Permissioned Domains|There's no contract/i
    // The unchanged hosted export includes an unbought comparison article, not a
    // claim that ResearchAgent uses channels. Allow only its four exact JSON lines;
    // the evidence-coherence check below also pins the whole export's SHA-256.
    const comparison = new Set([
      '"title": "Can an agent pay for many small x402 requests over an XRPL payment channel instead of one escrow per article?",',
      '"preview": "Sourced comparison of XRPL payment channels and key-reveal escrow for agent micropayments: what each costs on the ledger, what each guarantees about delivery, and when to use which.",',
      '"payment channel",',
      '"entity": "payment channel",',
    ])
    const hits: string[] = []
    for (const file of publicFiles) {
      for (const [i, line] of read(file).split('\n').entries()) {
        const alternative = file === 'docs/submission/evidence/hosted-answer-nov12/receipts.json' && comparison.has(line.trim())
        if ((did.test(line) || never.test(line)) && !denial.test(line) && !alternative) hits.push(`${file}:${i + 1}`)
      }
    }
    expect(hits).toEqual([])
  })

  it.each([
    'A Testnet Permissioned Domain lists the accepted issuer.',
    'Operator-issued identity uses a Permissioned Domain.',
    'A Permissioned Domain is for identity only, not KYC.',
    'Accepted Testnet Credentials.\n\n21\n00:01:24,264 --> 00:01:29,034\nA Permissioned Domain lists the issuer.',
    'A Testnet Permissioned Domain is for identity only; Mainnet spending remains disabled.',
    'No Permissioned Domains are used.',
  ])('allows the qualified or explicitly denied domain claim: %s', text => {
    expect(domainClaimViolations(text)).toEqual([])
  })

  it.each([
    'A Permissioned Domain lists the accepted issuer.',
    `Testnet ${'unrelated text '.repeat(40)}A Permissioned Domain lists the issuer.`,
    'A Testnet Permissioned Domain is used on Mainnet.',
    'A Mainnet Permissioned Domain is for identity only.',
    'A Testnet Permissioned Domain provides KYC.',
    "Operator-issued Permissioned Domains make writers KYC'd.",
  ])('rejects the unqualified, Mainnet or KYC domain claim: %s', text => {
    expect(domainClaimViolations(text)).not.toEqual([])
  })

  it('qualifies every Permissioned Domain claim in the submission and video', () => {
    const hits = publicFiles.flatMap(file => {
      const text = read(file)
      return domainClaimViolations(text).map(at => `${file}:${text.slice(0, at).split('\n').length}`)
    })
    expect(hits).toEqual([])
  })

  it('states the current Testnet identity and token scope, and recorded RLUSD verdicts', () => {
    for (const file of ['README.md', 'docs/submission/qa-prep.md', 'docs/submission/compliance-slide.md', 'docs/submission/deck/index.html']) {
      const text = read(file)
      expect(text, file).toMatch(/accepted.*(?:Testnet|XRPL Testnet)|accepted XRPL Testnet/)
      expect(text, file).toMatch(/Testnet Permissioned Domain/)
      expect(text, file).not.toMatch(/No Permissioned Domains|none in the live sandbox|sandbox's team writers are unverified/)
    }
    for (const file of ['README.md', 'docs/submission/short-description.md', 'docs/submission/qa-prep.md', 'docs/submission/deck/index.html']) {
      expect(read(file), file).toMatch(/live (?:sandbox|demo) pays in Testnet XRP/)
      expect(read(file), file).toContain('tecNO_PERMISSION')
      expect(read(file), file).not.toMatch(/predicted refusal|one issuer flag away/)
    }
    expect(read('docs/submission/qa-prep.md')).toMatch(/Testnet and Mainnet both have TokenEscrow enabled/)
  })

  it('makes the initial market a hypothesis and discloses the absence of traction', () => {
    for (const file of ['docs/submission/qa-prep.md', 'docs/submission/deck/index.html', 'docs/submission/short-description.md']) {
      const text = read(file).replace(/\s+/g, ' ')
      expect(text, file).toMatch(/initial.market hypothesis/i)
      expect(text, file).toContain('XRPL/x402 integrators')
      expect(text, file).toMatch(/coding agents/)
      expect(text, file).toMatch(/No independent writers, customers, pilots or revenue/i)
      expect(text, file).toContain('product-writer-paid.json')
    }
  })

  it('uses one hosted run for the useful-answer card and leaves absent model cost unmeasured', () => {
    const source = JSON.parse(read('docs/submission/evidence/hosted-answer-nov12/summary.json'))
    const receipts = JSON.parse(read('docs/submission/evidence/hosted-answer-nov12/receipts.json'))
    expect(source.runId).toBe(receipts.runId)
    expect(createHash('sha256').update(readFileSync('docs/submission/evidence/hosted-answer-nov12/receipts.json')).digest('hex')).toBe(source.receiptSha256)
    expect(Date.parse(source.done) - Date.parse(source.start)).toBe(source.startToDoneMs)
    const ledger = JSON.parse(read('docs/submission/evidence/hosted-answer-nov12/ledger.json'))
    for (const row of ledger.transactions) {
      expect(row.hash).toBe(source.transactions[row.kind])
      expect(row.validated).toBe(true)
      expect(row.result).toBe('tesSUCCESS')
    }
    expect(source.bought).toEqual(['product-writer-paid'])
    expect(source.spentMinor).toBe(40)
    expect(source.startToDoneMs).toBe(65797)
    expect(source.modelCostUsd).toBeNull()
    expect(source.deployedSha).toBe('5f683a0477c945153bd9a27a39ebd1a236f6951d')
    expect(source.refunds).toBe(0)
    expect(receipts.answers[0].claims).toEqual([])
    expect(receipts.answers[0].openGaps).toHaveLength(2)
    expect(receipts.answers.at(-1).openGaps).toEqual([])
    expect(source.evidence).toHaveLength(4)
    expect(source.evidence[2].text).toMatch(/validated transaction releases the payment/)
    for (const file of ['README.md', 'docs/submission/deck/index.html']) {
      expect(read(file), file).toContain(source.transactions.finish)
      expect(read(file), file).toContain('65.8')
      expect(read(file), file).toContain('unmeasured')
      expect(read(file), file).toMatch(/initial.*fixture/)
    }
  })

  it('says who pays which part of the fee: the buyer locks (12), the writer reveals (423), rippled needs 360', () => {
    for (const file of ['README.md', 'docs/numbers.md', 'docs/submission/qa-prep.md', 'docs/submission/short-description.md', 'docs/submission/pitch-2min.md', 'docs/submission/deck/index.html']) {
      expect(read(file), file).toMatch(/paid by the buyer|from the buyer/)
      expect(read(file), file).toMatch(/by the writer|from the writer|paid by the writer/)
    }
    expect(read('docs/numbers.md')).toContain("rippled's own minimum is 360")
    expect(read('docs/submission/qa-prep.md')).toContain("rippled's own minimum is 360")
  })

  it('counts the team-authored writers the corpus really has', () => {
    const team = readdirSync('data/writers').filter(f => /^team-.*\.json$/.test(f))
    expect(team).toHaveLength(2)
    expect(read('README.md')).toMatch(/Two team-authored writers/)
    expect(read('docs/submission/short-description.md')).toMatch(/two team-authored writers/i)
    expect(read('docs/submission/qa-prep.md')).toMatch(/two team-authored writers/i)
    // The old "one team-authored writer" wording must not come back.
    for (const file of publicFiles) expect(read(file), file).not.toMatch(/\bone team-authored writer\b|\bA team-authored writer is\b/i)
  })

  it('states the held-out scope everywhere it quotes the v5 numbers: fixture models, answers written offline, Testnet', () => {
    const scope = /fixture research and decision models/
    for (const file of ['README.md', 'docs/submission/short-description.md', 'docs/submission/qa-prep.md', 'docs/submission/pitch-2min.md']) {
      expect(read(file), file).toMatch(scope)
    }
    expect(read('docs/submission/qa-prep.md')).toMatch(/answers written offline/)
    // The held-out claim links the packet it comes from (v5), and the Q&A cites the commit v5 actually ran on.
    for (const file of ['docs/submission/pitch-2min.md', 'docs/submission/qa-prep.md', 'docs/submission/short-description.md']) {
      expect(read(file), file).toContain('evidence/v5-heldout/README.md')
    }
    const ran = read('docs/evidence/v5-heldout/README.md').match(/on `main` at `([0-9a-f]{40})`/)?.[1]
    expect(ran).toBeTruthy()
    expect(read('docs/submission/qa-prep.md')).toContain(`\`${ran!.slice(0, 8)}\``)
  })

  it('describes the purchase rule and the sandbox honestly on the hand-written site pages', () => {
    const talk = read('site/talk/index.html')
    expect(talk).toMatch(/no more than one article in a round, for up to three rounds/)
    expect(talk).not.toMatch(/buy the article it needs/)
    // The October replay keeps its own labels; the page footer no longer calls today's writers all synthetic.
    expect(talk).toContain('October replay: writers and articles SYNTHETIC')
    const home = read('site/index.html')
    expect(home).toContain('Shared XRPL Testnet demo · live answers, rule-based buying · no real value')
    expect(home).toContain('Replay · XRPL Testnet, recorded 11 Nov 2026 · fictional writers · no real value')
    expect(home).toContain('The recorded replay uses fixture models and fictional writers.')
  })

  it('has a release-note title for the latest CHANGELOG release, so /progress/ builds the day it is published', () => {
    const latest = read('CHANGELOG.md').match(/^## v(\d+\.\d+\.\d+) — /m)?.[1]
    expect(latest).toBeTruthy()
    expect(read('scripts/progress-story.mjs')).toContain(`'v${latest}': {`)
    expect(existsSync('docs/submission/deck/index.html')).toBe(true)
  })
})
