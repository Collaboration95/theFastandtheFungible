import { test, expect } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

test('production preview: initial JS, interactive, input → paint, and full UC2 replay CLS budgets', async ({ page }, info) => {
  test.setTimeout(45_000)
  const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8')) as Record<string, { file: string; imports?: string[] }>
  const files = new Set<string>()
  const visit = (key: string) => { const chunk = manifest[key]; if (files.has(chunk.file)) return; files.add(chunk.file); chunk.imports?.forEach(visit) }
  visit('index.html')
  const initialJsGzip = (await Promise.all([...files].map(async file => gzipSync(await readFile(`dist/${file}`)).length))).reduce((a, b) => a + b, 0)
  const paletteFile = [...files].find(file => file.includes('command-palette'))!
  const paletteJsGzip = gzipSync(await readFile(`dist/${paletteFile}`)).length
  await page.addInitScript(() => {
    const metrics = { cls: 0, shifts: [] as unknown[], paints: [] as { key: string; ms: number }[] }
    Object.assign(window, { foundationMetrics: metrics })
    new PerformanceObserver(list => { for (const entry of list.getEntries()) { const item = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }; if (!item.hadRecentInput) { metrics.cls += item.value; metrics.shifts.push({ value: item.value, sources: (item as unknown as { sources: { node?: Element; previousRect: DOMRect; currentRect: DOMRect }[] }).sources.map(s => ({ node: s.node?.className, before: s.previousRect.toJSON(), after: s.currentRect.toJSON() })) }) } } }).observe({ type: 'layout-shift', buffered: true })
    document.addEventListener('keydown', event => {
      if (!(event.ctrlKey || event.metaKey) || !['k', '1', '2'].includes(event.key)) return
      const start = performance.now()
      requestAnimationFrame(() => requestAnimationFrame(() => metrics.paints.push({ key: event.key, ms: performance.now() - start })))
    })
  })
  const start = performance.now()
  await page.goto('/?record=1')
  await expect(page.getByRole('textbox', { name: 'Your question' })).toBeEditable()
  const interactiveMs = performance.now() - start
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('combobox')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+2')
    await expect(page.getByRole('tab', { name: /Writers/ })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Control+1')
    await expect(page.getByRole('tab', { name: /Run/ })).toHaveAttribute('aria-selected', 'true')
  }
  const paints = await page.evaluate(() => (window as unknown as { foundationMetrics: { paints: { key: string; ms: number }[] } }).foundationMetrics.paints)
  const p95 = (key: string) => { const values = paints.filter(item => key.includes(item.key)).map(item => item.ms).sort((a, b) => a - b); return values[Math.ceil(values.length * .95) - 1] }
  await page.keyboard.press('Control+k')
  await page.keyboard.type('UC2 ·')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Your question' })).toHaveValue(/Kestrel/)
  await page.keyboard.press('Control+Enter')
  await page.getByRole('button', { name: 'pricing & margins' }).press('Enter')
  await page.keyboard.press('Control+Enter')
  await expect(page.getByRole('region', { name: 'Research answer' })).toBeVisible()
  // Start at the mounted run shell, then include every paced event, not the intentional page navigation.
  await page.evaluate(() => { (window as unknown as { foundationMetrics: { cls: number } }).foundationMetrics.cls = 0 })
  await expect(page).toHaveTitle(/Answer ready/, { timeout: 60_000 })
  console.log('SHIFT DETAILS', JSON.stringify(await page.evaluate(() => (window as unknown as { foundationMetrics: { shifts: unknown[] } }).foundationMetrics.shifts)))
  const cls = await page.evaluate(() => (window as unknown as { foundationMetrics: { cls: number } }).foundationMetrics.cls)
  const result = { initialJsGzip, paletteJsGzip, interactiveMs, paletteP95Ms: p95('k'), viewSwitchP95Ms: p95('12'), uc2Cls: cls, environment: 'local Chromium, production vite preview, fixture replay, 1280×720' }
  await mkdir('.playwright/evidence', { recursive: true })
  await writeFile('.playwright/evidence/perf.json', JSON.stringify(result, null, 2))
  await info.attach('performance', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  console.log(JSON.stringify(result))
  expect(paletteJsGzip).toBeLessThan(10_000)
  expect(initialJsGzip).toBeLessThan(170_000)
  expect(interactiveMs).toBeLessThan(2000)
  expect(result.paletteP95Ms).toBeLessThan(50)
  expect(result.viewSwitchP95Ms).toBeLessThan(50)
  expect(cls).toBeLessThan(.02)
})
