// Local fixture timing, from Start now (plan confirmation excluded) to rendered answer/DONE.
import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const browser = await chromium.launch()
const rows = []
try {
  for (const pace of ['stage', 'real']) for (const [id, question] of [
    ['UC1', 'What did the Bank of Japan change at its last meeting, and how did 10-year JGB yields react?'],
    ['UC2', "What's the analyst outlook on Kestrel Semiconductor's latest deal with TSMC?"],
    ['UC3', "Are Kestrel Semiconductor's advanced-packaging lead times in Malaysia getting shorter?"],
  ]) {
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:5600/?pace=${pace}`)
    await page.getByRole('region', { name: "What's real here" }).waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('textbox', { name: 'Your question' }).fill(question)
    await page.getByRole('button', { name: /^Ask/ }).click()
    const clarify = page.getByRole('button', { name: /pricing & margins/i })
    if (id === 'UC2') await clarify.click()
    const start = page.getByRole('button', { name: 'Start now' })
    await start.waitFor()
    const t = performance.now()
    await start.click()
    await page.locator('.ra-vtext:not(.is-skel)').waitFor({ timeout: 120000 })
    const firstMs = Math.round(performance.now() - t)
    await page.waitForFunction(() => document.title.includes('Answer ready'), undefined, { timeout: 180000 })
    const finalMs = Math.round(performance.now() - t)
    rows.push({ id, pace, firstMs, finalMs })
    console.log(JSON.stringify(rows.at(-1)))
    await writeFile(process.argv[2], JSON.stringify({ measuredAt: new Date().toISOString(), rows }, null, 2) + '\n')
    await page.close()
  }
  await writeFile(process.argv[2], JSON.stringify({ measuredAt: new Date().toISOString(), rows }, null, 2) + '\n')
} finally { await browser.close() }
