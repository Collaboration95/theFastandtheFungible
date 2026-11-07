import { register } from 'node:module'
register('tsx/esm', import.meta.url)
const { ResourceScope } = await import('../shared/resource-scope.ts')
const scope = new ResourceScope()
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { allocateDemoPorts } from './demo-ports.mjs'

// No shared ledger or provider calls. All ports, stores and processes belong to this take.
const clip = process.argv.includes('--clip')
const uc = process.env.UC || 'UC2'
if (!/^UC[1-4]$/.test(uc)) throw new Error('UC must be UC1, UC2, UC3 or UC4')
const ports = clip ? await allocateDemoPorts() : { web: 5100 + Number(process.env.DEMO_PORT_OFFSET || 300), api: 8788 + Number(process.env.DEMO_PORT_OFFSET || 300), pub: 8790 + Number(process.env.DEMO_PORT_OFFSET || 300) }
try {
const store = scope.tempDir('researchagent-record-')
const env = { ...process.env, DOTENV_CONFIG_PATH: '.record-no-env', DEMO_WEB_PORT: String(ports.web), DEMO_API_PORT: String(ports.api), DEMO_PUBLISHER_PORT: String(ports.pub), PUBLISHER_URL: `http://127.0.0.1:${ports.pub}`, APP_DB: `${store}/app.db`, PUBLISHER_DB: `${store}/publisher.db`, REPORT_DIR: `${store}/reports`, SETTLEMENT_RAIL: 'simulated', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0' }
const child = scope.spawn(process.execPath, ['scripts/demo.mjs'], { env, stdio: 'inherit' })
let browser
scope.defer(() => browser?.close())
async function cleanup() { await scope.close() }
process.on('SIGINT', () => { void cleanup().then(() => process.exit()) })
process.on('SIGTERM', () => { void cleanup().then(() => process.exit()) })
const url = `http://127.0.0.1:${ports.web}/?record=1`
console.log(`Record mode: ${url} · fresh fixture store · SIMULATED · Ctrl+C to stop`)
if (clip) {
  try {
    const { chromium } = await import('@playwright/test')
    const { DEMO_QUESTIONS } = await import('../shared/contracts/examples.ts')
    const preset = process.env.VIEWPORT || '1280x800'
    if (!['1920x1080', '1280x800', '1080x1350'].includes(preset)) throw new Error('VIEWPORT must be 1920x1080, 1280x800 or 1080x1350')
    const [width, height] = preset.split('x').map(Number)
    await mkdir('clips', { recursive: true })
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', recordVideo: { dir: 'clips/.takes', size: { width, height } } })
    const page = await context.newPage()
    // Startup polling only; CI/PR checks are never polled here.
    await expectReady()
    await page.goto(url)
    await page.evaluate(() => document.fonts.ready)
    // Stills and clips leave the app, so bake in their own environment footer.
    await page.addStyleTag({ content: 'body::after { content: "Demo data · simulated payments"; position: fixed; bottom: 0; right: 0; z-index: 100; padding: 4px 12px; background: #FBF8F2; color: #655D55; font: 12px Arial,sans-serif; }' })
    const takeStart = Date.now()
    await page.keyboard.press('Control+k')
    await page.getByRole('combobox').fill(`${uc === 'UC4' ? 'New question' : uc + ' ·'}`)
    await page.keyboard.press('Enter')
    // UC4 is intentionally outside the three primary preset commands.
    if (uc === 'UC4') { await page.keyboard.press('Escape'); await page.getByRole('textbox', { name: 'Your question' }).fill(DEMO_QUESTIONS.find(item => item.id === uc).text) }
    await page.waitForFunction(() => !!document.querySelector('textarea')?.value)
    await page.keyboard.press('Control+Enter')
    const clarify = page.getByRole('button', { name: 'pricing & margins' })
    if (uc === 'UC2') await clarify.press('Enter')
    await page.getByRole('button', { name: 'Start now' }).waitFor()
    await page.keyboard.press('Control+Enter')
    await page.waitForFunction(() => document.title.includes('Answer ready'), { timeout: 60_000 })
    // Hold the cited result for a readable ending; total take is padded to 18 seconds below.
    await page.screenshot({ path: `clips/${uc.toLowerCase()}-after.png` })
    await new Promise(done => setTimeout(done, Math.max(1000, 18000 - (Date.now() - takeStart))))
    await context.close()
    const { rename, stat } = await import('node:fs/promises')
    const output = `clips/${uc.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.webm`
    await rename(await page.video().path(), output)
    if (!(await stat(output)).size) throw new Error('Empty recording')
    const ffmpeg = scope.spawn('ffmpeg', ['-y', '-i', output, '-t', '20', '-vf', 'tpad=stop_mode=clone:stop_duration=18', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', output.replace('.webm', '.mp4')], { stdio: 'ignore' })
    ffmpeg.on('error', () => console.log('ffmpeg unavailable; WebM is ready.'))
    await new Promise(done => { ffmpeg.on('error', done); ffmpeg.on('exit', done) })
    console.log(`Clip saved: ${resolve(output)}`)
  } finally { await cleanup() }
}
async function expectReady() {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error('Record server exited')
    try { if ((await fetch(new URL('/api/health', url))).ok && (await fetch(url)).ok) return } catch { /* startup */ }
    await new Promise(done => setTimeout(done, 200))
  }
  throw new Error('Record server did not become ready')
}

} catch (error) { await scope.close(); throw error }
