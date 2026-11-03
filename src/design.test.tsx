import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('enforces the shared UX type scale and motion allowlist', () => {
  const css = readFileSync('src/styles.css', 'utf8')
  expect([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1])).toEqual(['fade-in', 'rise-4', 'spin', 'countdown'])
  expect(css.match(/\binfinite\b/g)).toHaveLength(1)
  expect(css).not.toMatch(/--ease-spring|animation-delay:\s*calc|\bshimmer\s+\d/)
  const sizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(m => Number(m[1]))
  expect([...new Set(sizes)].sort((a,b) => a-b)).toEqual([12,13,14,15,20,28,32])
})
