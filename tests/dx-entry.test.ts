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
test('verification explains attribution SKIPs without treating them as identity proof', () => {
  const output = verificationText({ ok: true, checks: [{ check: 'writer credentials', status: 'SKIP', detail: 'Unsigned advisory identity; requires online check' }] })
  expect(output).toContain('SKIP writer credentials')
  expect(output).toContain('PASS does not verify a writer identity')
})
