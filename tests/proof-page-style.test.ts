import { expect, it } from 'vitest'
import { readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { PROOF_TOKENS } from '../server/proof-tokens.js'
import { PROOF_FONTS } from '../server/proof-fonts.js'
import { renderProofPage, renderProofMissing, proofCsp, proofEnvironmentLabel } from '../server/proof-page.js'
import type { ProofSnapshot } from '../shared/refusal-proof.js'

const snapshot: ProofSnapshot = {
  version: 'refusal-proof-v1', bought: { count: 0, spentMinor: 0, currency: 'SGD' }, id: 'a'.repeat(32), question: 'Which banks are piloting RLUSD?', askedAt: '2026-11-11T07:06:00Z', createdAt: '2026-11-11T07:07:00Z',
  environment: { surface: 'hosted', models: 'fixture', network: 'XRPL Testnet', label: '' }, found: { paid: 0, free: 0, writers: 0, items: [], more: 0 },
  anchor: { version: 'anchor-v1', network: 'xrpl:1', runIdHash: 'c'.repeat(64), feeDrops: '12', txHash: 'ABCDEF01'.repeat(8), account: 'rTestAccount', head: 'b'.repeat(64), ledgerIndex: 1 },
  verification: { ok: true, at: '2026-11-11T07:07:00Z', passed: 13, skipped: 4, total: 17 }, outcome: { summary: 'Nothing was bought.' }, bundle: {} as ProofSnapshot['bundle'],
}
const page = renderProofPage(snapshot, { mode: 'page', nonce: 'STYLE' })

it('uses the exact app tokens, with no second palette to drift', () => {
  expect(PROOF_TOKENS).toBe(readFileSync('src/tokens.css', 'utf8').trim())
  expect(page).toContain(PROOF_TOKENS)
  expect(page).toContain('border-color:var(--rule-strong)')
  expect(page).not.toContain('#C9BFB2')
})

it('self-hosts both variable fonts, with immutable content-addressed assets and no external font URL', () => {
  const urls = [...PROOF_FONTS.matchAll(/url\("([^"]+)"\)/g)].map(m => m[1])
  expect(urls).toHaveLength(2)
  for (const url of urls) {
    expect(url).toMatch(/^\/assets\/proof-fonts\/geist(?:-mono)?-latin-wght-normal-[a-f0-9]{12}\.woff2$/)
    const bytes = readFileSync(`public${url}`)
    expect(url).toContain(createHash('sha256').update(bytes).digest('hex').slice(0, 12))
  }
  expect(PROOF_FONTS.match(/font-weight:100 900;font-display:swap/g)).toHaveLength(2)
  expect(page.match(/url\([^)]+\)/g)?.every(url => url.startsWith('url("/assets/'))).toBe(true)
  expect(page).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com|<link[^>]+https:[^>]+(?:font|stylesheet)/i)
  expect(proofCsp('STYLE')).toContain("font-src 'self'")
  expect(readFileSync('docker/hosted/nginx.conf', 'utf8')).toContain('location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }')
  // Include the longest provenance label, not only the shorter legacy label.
  const longest = renderProofPage({ ...snapshot, environment: { ...snapshot.environment, models: 'live', research: { provider: 'fixture', fallback: true } } }, { mode: 'page', nonce: 'STYLE' })
  expect(Buffer.byteLength(longest) + urls.reduce((n, url) => n + statSync(`public${url}`).size, 0)).toBeLessThanOrEqual(60 * 1024)
})

it('sets the button font explicitly and keeps every caption in sentence case', () => {
  expect(page).toMatch(/\.btn\{[^}]*font:600 13px\/1 var\(--f-ui\)/)
  expect(page).not.toContain('text-transform:uppercase')
  expect(page).not.toContain('font:600 13px/1 inherit')
  expect(page).toContain('ABCDEF01…ABCDEF01')
  expect(page).toContain('11 Nov 2026, 15:06 SGT')
})

it('extends Verify and Download hit areas to 44 px without enlarging the visible buttons', () => {
  for (const mode of ['page', 'card'] as const) {
    const html = renderProofPage(snapshot, { mode })
    expect(html).toMatch(/\.btn\{[^}]*position:relative;[^}]*min-height:36px/)
    expect(html).toMatch(/\.btn::after\{[^}]*position:absolute;[^}]*height:100%;min-height:44px;transform:translateY\(-50%\)/)
  }
})

it('keeps an older frozen snapshot free of answer-source claims', () => {
  const label = 'Shared XRPL Testnet demo · rule-based buying · no real value'
  expect(proofEnvironmentLabel(snapshot.environment)).toBe(label)
  expect(page).toContain(label)
  expect(proofEnvironmentLabel({ surface: 'local', models: 'fixture' })).toBe('XRPL Testnet demo · rule-based buying · no real value')
})

it('keeps downloaded cards offline with system fonts, and styles missing pages with Geist', () => {
  const card = renderProofPage(snapshot, { mode: 'card' })
  expect(card).not.toContain('@font-face')
  expect(card).not.toContain('<script')
  expect(card).toContain('--f-ui:system-ui,sans-serif;--f-mono:ui-monospace,monospace')
  expect(renderProofMissing('STYLE')).toContain(PROOF_FONTS)
})
