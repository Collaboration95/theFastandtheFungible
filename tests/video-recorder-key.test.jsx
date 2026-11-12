import React from 'react'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium } from 'playwright'
import { KeyCheckResult } from '../src/components/KeyRevealLifecycle'
import { waitForKeyMatch } from '../scripts/video/scenes.mjs'

let browser
beforeAll(async () => { browser = await chromium.launch({ headless: true }) })
afterAll(async () => { await browser?.close() })
it('records the real matching-key result with an SVG checkmark, and rejects mismatch', async () => {
  const page = await browser.newPage()
  const escrow = { createHash: 'A'.repeat(64), finishHash: 'B'.repeat(64) }
  try {
    await page.setContent(renderToStaticMarkup(<KeyCheckResult escrow={escrow} check={{ status: 'match', lock: 'AB', key: 'CD', ledger: 1, node: 'public Testnet' }} />))
    const result = await waitForKeyMatch(page, 1000)
    expect(await result.innerText()).toContain('sha256(key) = lock')
    expect(await result.innerText()).not.toContain('✓')
    await page.setContent(renderToStaticMarkup(<KeyCheckResult escrow={escrow} check={{ status: 'mismatch', why: 'key', lock: 'AB', key: 'CD' }} />))
    await expect(waitForKeyMatch(page, 100)).rejects.toThrow(/Timeout/)
  } finally { await page.close() }
})
