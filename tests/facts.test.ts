import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
// @ts-expect-error plain ESM script without types
import { build, fill, strip, spoken, markedFiles } from '../scripts/facts.mjs'

const read = (path: string) => readFileSync(path, 'utf8')
type Facts = Record<string, { value: string; source: string; definition: string }>

describe('facts: one source for every number a judge reads', () => {
  const data = build() as { facts: Facts; links: Record<string, string>; source_sha: string }

  it('keeps facts.json and every marked number current', () => {
    expect(() => execFileSync(process.execPath, ['scripts/facts.mjs', '--check'], { encoding: 'utf8' })).not.toThrow()
    expect(JSON.parse(read('docs/submission/facts.json')).facts).toEqual(data.facts)
  })

  it('development mode reads used banks (v1–v5) and never opens an unmeasured one', () => {
    // v5 was measured on 10 Nov 2026, so its results are development data: the dev-only build must equal the full build.
    const code = `
      import fs from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      import { heldOutBankPath } from './scripts/local-gate-banks.mjs';
      const original = fs.readFileSync;
      const relative = path => String(path).replace(process.cwd() + '/', '');
      let reads = 0;
      fs.readFileSync = function(path, ...args) {
        if (heldOutBankPath(relative(path))) throw Error('Forbidden held-out read');
        if (/docs\\/evidence\\/v5-heldout\\/v5\\/results\\.json$/.test(String(path))) reads++;
        return original.call(this, path, ...args);
      };
      syncBuiltinESMExports();
      process.env.RA_DEV_BANKS_ONLY = '1';
      process.argv[1] = 'development-fact-read-audit';
      const { build, markedFiles } = await import('./scripts/facts.mjs');
      const facts = build().facts;
      if (!facts.heldout || !markedFiles().includes('README.md')) throw Error('Missing aggregate or marker checks');
      if (!reads) throw Error('Used bank v5 results were not read in development mode');
      console.log(JSON.stringify(facts));
    `
    const dev = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' }).trim().split('\n').pop()!)
    expect(dev).toEqual(data.facts)
  })

  it('derives counts from the generated progress data, not by hand', () => {
    const progress = JSON.parse(read('site/progress/data.json'))
    expect(data.facts.prs.value).toBe(String(progress.headline.prs))
    expect(data.facts.releases.value).toBe(String(progress.headline.releases))
    expect(data.facts.transactions.value).toBe(String(progress.headline.transactions))
    expect(data.facts.findings.value).toBe(String(progress.feedback.findings))
    expect(data.source_sha).toBe(progress.source_sha)
    expect(Number(data.facts.vectors.value)).toBe(Number(data.facts.vectors_golden.value) + Number(data.facts.vectors_tampered.value))
    expect(Number(data.facts.fee_drops.value)).toBe(Number(data.facts.fee_create.value) + Number(data.facts.fee_finish.value))
    for (const [key, fact] of Object.entries(data.facts)) expect(fact.value, key).not.toBe('')
  })

  it('fills markers, refuses unknown keys and renders without them', () => {
    const facts = { n: { value: '7', source: 's', definition: 'd' } }
    expect(fill('a <!--f:n-->old<!--/f--> b', facts)).toBe('a <!--f:n-->7<!--/f--> b')
    expect(() => fill('<!--f:nope-->x<!--/f-->', facts)).toThrow(/unknown fact "nope"/)
    expect(strip('a <!--f:n-->7<!--/f--> b')).toBe('a 7 b')
    expect(spoken(7)).toBe('seven')
    expect(spoken(217)).toBe('217')
  })

  it('marks the numbers on the README and every submission text', () => {
    const files = markedFiles()
    for (const file of ['README.md', 'docs/numbers.md', 'docs/submission/qa-prep.md']) expect(files).toContain(file)
  })

  it('keeps the README and submission texts true to the hosted decision and the SingHacks baseline', () => {
    const texts = ['README.md', 'docs/submission/short-description.md', 'docs/submission/pitch-2min.md', 'docs/submission/qa-prep.md', 'docs/submission/demo-video-script.md'].map(f => [f, strip(read(f))])
    for (const [file, text] of texts) {
      expect(text, file).not.toMatch(/no hosted instance|chose not to host|approved every purchase|human approved/i)
      expect(text, file).not.toMatch(/buys the one article|the one article it/i)
      expect(text, file).not.toMatch(/\b183\b/)
    }
    const readme = strip(read('README.md'))
    expect(readme).toContain(data.links.hosted)
    expect(readme).toContain('13–19 Nov 2026')
    expect(readme).toContain(data.facts.feedback_line.value)
    for (const file of ['README.md', 'docs/install.md', 'docs/submission/short-description.md', 'docs/submission/README.md']) {
      for (const url of read(file).match(/https:\/\/ra-front-[\w.-]+\.run\.app/g) ?? []) expect(url, file).toBe(data.links.hosted)
    }
  })

  it('keeps the README a product page: three badges, one screenshot, no hosted-CI badge', () => {
    const readme = read('README.md')
    expect(readme.match(/img\.shields\.io/g)).toHaveLength(3)
    expect(readme).not.toMatch(/actions\/workflows\/[\w.-]+\/badge\.svg|codespaces\.new/)
    expect(readme).toContain('docs/media/readme-answer.png')
    const prose = strip(readme).replace(/<!--[\s\S]*?-->/g, '').replace(/```[\s\S]*?```/g, '').replace(/<details>[\s\S]*?<\/details>/g, '').replace(/<[^>]+>/g, '').replace(/\]\([^)]*\)/g, ']')
    expect(prose.split(/\s+/).filter(Boolean).length).toBeLessThan(1100)
  })
})
