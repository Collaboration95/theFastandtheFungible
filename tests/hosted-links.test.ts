// The demo page's "Ask your own question" link and the built app's og:url come from shared/links.ts; the submission
// facts (README, deck, form) carry their own copy. A judge must land on the same hosted sandbox from every one of them.
import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { HOSTED_APP_URL } from '../shared/links'

it('the app, demo page and submission facts point at the same hosted sandbox', () => {
  const facts = JSON.parse(readFileSync(new URL('../docs/submission/facts.json', import.meta.url), 'utf8'))
  expect(HOSTED_APP_URL).toMatch(/^https:\/\/[^/]+$/)
  expect(HOSTED_APP_URL).toBe(facts.links.hosted)
})
