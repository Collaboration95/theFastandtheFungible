import { expect, test } from 'vitest'
import { markdownCorpus } from '../publisher/publishing/markdown.js'
import { createClient } from '../sdk/index.js'
import { verificationText } from '../sdk/verify.js'

test('missing writer folder points to init before wallet provisioning', async () => {
  await expect(markdownCorpus('/missing/dx-notes', 'notes', 'Notes')).rejects.toThrow('Run init my-notes')
})
test('missing engine URL has actionable configuration help without echoing input', () => {
  expect(() => createClient({ baseUrl: '' })).toThrow('set baseUrl (RA_URL) to the engine URL printed by app')
})
test('verification explains skipped attribution checks in plain words without treating them as identity proof', () => {
  const output = verificationText({ ok: true, checks: [{ check: 'writer credentials', status: 'SKIP', detail: 'the writer’s identity is self-declared; checking it needs an online lookup' }] })
  expect(output).toContain('Skipped writer credentials')
  expect(output).not.toMatch(/^SKIP /m)
  expect(output).toContain('Skipped checks are not failures')
  expect(output).toContain('PASS does not prove who a writer is')
})
