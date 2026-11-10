import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Pins and schema-checks the frozen single-use v5 held-out bank. This test only
// hashes and parses the files; it never runs the bank. Changing a byte means the
// bank is no longer the frozen artifact, so re-pinning needs an explicit decision.
const dir = new URL('../eval/questions/', import.meta.url)
const PINNED = {
  'judge-xrpl.v5.json': '1095c9fac057a85ee59a34a63cb72ea69a0ec909f430c845357958bf38c1701b',
  'judge-xrpl.v5-negatives.json': 'a381c46f85676bce13c8f9183370fe4989cc9f38c50dd118702c48bb55067c4b',
} as const

const load = (name: keyof typeof PINNED) => {
  const bytes = readFileSync(new URL(name, dir))
  return { sha: createHash('sha256').update(bytes).digest('hex'), bank: JSON.parse(bytes.toString('utf8')) }
}

describe('judge bank v5 (frozen, single-use)', () => {
  it.each(Object.entries(PINNED))('%s matches its pinned SHA-256', (name, sha) => {
    expect(load(name as keyof typeof PINNED).sha).toBe(sha)
  })

  it('positive bank has 20 unique questions with short non-blank gold phrases', () => {
    const { bank } = load('judge-xrpl.v5.json')
    expect(bank.version).toBe(5)
    expect(bank.frozenBeforeIngestion).toBe(true)
    expect(bank.questions).toHaveLength(20)
    expect(new Set(bank.questions.map((q: { id: string }) => q.id)).size).toBe(20)
    expect(new Set(bank.questions.map((q: { question: string }) => q.question)).size).toBe(20)
    for (const q of bank.questions) {
      expect(Object.keys(q).sort()).toEqual(['gold', 'id', 'question', 'topic'])
      expect(q.id).toMatch(/^H\d{2}$/)
      expect(q.question.trim().endsWith('?')).toBe(true)
      expect(q.gold.trim()).toBe(q.gold)
      expect(q.gold.length).toBeGreaterThan(0)
      expect(q.gold.length).toBeLessThanOrEqual(32)
    }
  })

  it('negative bank has 10 unique no_purchase questions and no gold', () => {
    const { bank } = load('judge-xrpl.v5-negatives.json')
    expect(bank.version).toBe(5)
    expect(bank.frozenBeforeIngestion).toBe(true)
    expect(bank.questions).toHaveLength(10)
    expect(new Set(bank.questions.map((q: { id: string }) => q.id)).size).toBe(10)
    for (const q of bank.questions) {
      expect(Object.keys(q).sort()).toEqual(['expect', 'id', 'question', 'topic'])
      expect(q.id).toMatch(/^NG\d{2}$/)
      expect(q.expect).toBe('no_purchase')
    }
  })

  it('shares no question text with the positives', () => {
    const pos = new Set(load('judge-xrpl.v5.json').bank.questions.map((q: { question: string }) => q.question))
    for (const q of load('judge-xrpl.v5-negatives.json').bank.questions) expect(pos.has(q.question)).toBe(false)
  })
})
