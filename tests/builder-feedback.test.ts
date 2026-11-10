import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const doc = readFileSync('docs/BUILDER-FEEDBACK.md', 'utf8')
const kit = readFileSync('docs/feedback/upstream/FILING-KIT.md', 'utf8')
const drafts = readdirSync('docs/feedback/upstream').filter(f => /^0\d-.*\.md$/.test(f)).sort()
const summary = doc.slice(doc.indexOf('## Top 7 ranked findings'), doc.indexOf('## What worked well'))

describe('builder feedback document', () => {
  it('keeps B01 to B35 contiguous and unique', () => {
    const ids = [...doc.matchAll(/^\| (B\d+) ·/gm)].map(m => m[1])
    expect(ids).toEqual(Array.from({ length: 35 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`))
  })

  it('has exactly seven ranked rows, each with a draft and a repro that exist', () => {
    const rows = [...summary.matchAll(/^\| (\d) \|.*$/gm)]
    expect(rows.map(r => r[1])).toEqual(['1', '2', '3', '4', '5', '6', '7'])
    const linked = rows.map(r => /feedback\/upstream\/(0\d-[a-z-]+\.md)/.exec(r[0])?.[1])
    for (const file of linked) expect(file && existsSync(`docs/feedback/upstream/${file}`)).toBeTruthy()
    expect(new Set(linked).size).toBe(7)
    for (const row of rows) expect(row[0]).toMatch(/Not filed|Filed:/)
    for (const file of linked) expect(readdirSync('scripts/repro')).toContain(file!.replace(/\.md$/, '.mjs'))
  })

  it('states every count that other surfaces quote, and the README agrees', () => {
    expect(doc).toContain('35 numbered log items (B01–B35)')
    expect(doc).toContain('8 upstream issue drafts, **0 filed**')
    expect(doc).toContain('"35 numbered findings (B01–B35)"')
    expect(readFileSync('README.md', 'utf8')).toContain('35 numbered findings (B01–B35)')
    expect(drafts).toHaveLength(8)
  })

  it('separates the three classes the project rules require', () => {
    for (const heading of ['### B.1 Observed on XRPL Testnet', '### B.2 Code-derived failure modes', '### B.3 Observed friction in our own tooling', '## Part C. Historical research']) expect(doc).toContain(heading)
  })

  it('keeps the anchors other documents link to', () => {
    for (const heading of ['## Mainnet readiness checklist', '### 1. Issuer permission blocks RLUSD escrow']) expect(doc).toContain(heading)
  })

  it('records the 10 Nov cold-IOU observation with its evidence file', () => {
    expect(doc).toContain('2026-11-10 · Cold Testnet IOU start versus the MCP tool timeout')
    expect(existsSync('docs/evidence/nov10-reachability/README.md')).toBe(true)
  })
})

describe('upstream drafts', () => {
  const sections = ['## Summary', '## Environment', '## Steps to reproduce', '## Expected', '## Actual', '## Workaround we use', '## Proposed fix', '## Scope and limits']
  it.each(drafts)('%s is paste-ready and listed in the filing table', file => {
    const text = readFileSync(`docs/feedback/upstream/${file}`, 'utf8')
    expect(text).toMatch(/^# .{20,}/)
    expect(text).toMatch(/\*\*Target:\*\* `[\w.-]+\/[\w.-]+`/)
    expect(text).toContain('not filed')
    const body = text.slice(text.indexOf('\n---\n'))
    expect(body.length).toBeGreaterThan(200)
    let at = 0
    for (const section of sections) {
      const next = body.indexOf(`\n${section}\n`, at)
      expect(next, `${file} lacks ${section}`).toBeGreaterThanOrEqual(0)
      at = next
    }
    expect(kit).toContain(`\`${file}\``)
  })
})

describe('Memo size repro', () => {
  it('runs offline and shows the live-observed overflow and the 18-byte headroom', () => {
    const out = execFileSync(process.execPath, ['scripts/repro/08-memo-size.mjs'], { encoding: 'utf8', timeout: 30_000 })
    expect(out).toMatch(/1027 bytes serialized Memos \(MemoData 997 bytes\) REJECTED/)
    expect(out).toMatch(/1006 bytes serialized Memos \(MemoData 976 bytes\) ok/)
    expect(out).toContain('Headroom after the workaround: 18 bytes')
  })
})
