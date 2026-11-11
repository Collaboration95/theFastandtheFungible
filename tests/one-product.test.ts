import { expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import exceptions from './one-product-exceptions.json'
import { sitePresentation } from '../scripts/site-presentation.mjs'
import { ENV, money, shortTx, dateSGT, whenSGT } from '../shared/presentation'
import { minorText, environment, type Hosted } from '../src/hosted'
import { shortHex } from '../src/verify/key-on-ledger'
import { proofEnvironmentLabel } from '../shared/execution-labels'
import { ledgerReadTime } from '../src/ledger-check'
import { presentationDrift } from '../scripts/one-product'
const files = (root: string): string[] => readdirSync(root, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(root, e.name)) : /\.(?:css|html|[cm]?[jt]sx?)$/.test(e.name) && !/\.test\.|\.d\.ts$/.test(e.name) ? [join(root, e.name)] : [])
it('keeps one presentation contract across app, replay, proof and site', () => {
  const paths = [...files('src'), ...files('demo'), 'server/proof-page.ts', ...files('site')].filter(p => !p.startsWith('src/fixtures/') && !p.startsWith('demo/traces/') && !p.startsWith('site/demo/') && p !== 'site/brand/presentation.js')
  const headingClasses = new Set(paths.flatMap(file => [...readFileSync(file, 'utf8').matchAll(/<h[1-6]\b[^>]*class(?:Name)?=["']([^"']+)/g)].flatMap(m => m[1].split(/\s+/))))
  const found = paths.flatMap(file => presentationDrift(readFileSync(file, 'utf8'), file, headingClasses).map(v => ({ file, ...v })))
  // Exact file/rule/text matches only: new drift and stale exceptions both fail.
  const identity = (v: { file: string; rule: string; text: string }) => JSON.stringify([v.file, v.rule, v.text])
  expect(found.filter(v => !exceptions.some(e => identity(e) === identity(v)))).toEqual([])
  expect(exceptions.filter(e => !e.reason.trim() || !found.some(v => identity(e) === identity(v)))).toEqual([])
  expect(readFileSync('site/brand/presentation.js', 'utf8')).toBe(sitePresentation())
  expect(minorText).toBe(money); expect(shortHex).toBe(shortTx); expect(ledgerReadTime).toBe(whenSGT)
  // Valid parameterised labels (including en-GB's September abbreviation) must not be false positives.
  for (const label of [ENV.localTestnet('fixture models'), ENV.localSimulated('live answers, rule-based buying'), ENV.hostedConfigured(false, 'live'), ENV.replay(dateSGT('2026-09-19T00:00:00Z'))]) expect(presentationDrift(`<p>${label}</p>`, 'valid.html').filter(v => v.rule === 'environment')).toEqual([])
  // Source font loaders and deployed font files must exist, not just a family name.
  const main = readFileSync('src/main.tsx', 'utf8')
  for (const family of ['geist', 'geist-mono']) expect(main).toContain(`import '@fontsource-variable/${family}'`)
  for (const file of ['site/brand/fonts.css', 'demo/style.css', 'server/proof-fonts.ts']) {
    const css = readFileSync(file, 'utf8')
    expect(css).toContain('@font-face'); expect(css).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/)
  }
  for (const surface of ['local', 'hosted'] as const) for (const models of ['fixture', 'live'] as const) {
    const buying = models === 'fixture' ? 'rule-based buying' : 'model-judged buying'
    expect(proofEnvironmentLabel({ surface, models })).toBe(`${surface === 'hosted' ? 'Shared ' : ''}${ENV.localTestnet(buying)}`)
    for (const provider of ['fixture', 'deepseek'] as const) for (const fallback of [false, true]) {
      const answers = provider === 'fixture' || fallback ? 'offline extract answers' : 'live answers'
      expect(proofEnvironmentLabel({ surface, models, research: { provider, fallback } })).toBe(`${surface === 'hosted' ? 'Shared ' : ''}${ENV.localTestnet(`${answers}, ${buying}`)}`)
    }
  }
  // Configured buying says nothing about the provenance of an individual answer.
  for (const testnet of [true, false]) for (const state of ['ready', 'paused', 'ended'] as const) {
    const status = { state, labels: { rail: testnet ? 'XRPL Testnet' : 'simulated', models: 'fixture models' } } as Hosted['status']
    const env = environment(status)
    expect(env.full).toMatch(/no real value$/); expect(env.short).toMatch(/no real value$/)
    expect(env.full).not.toContain('live answers')
    if (state === 'ready') { expect(env.full).toBe(ENV.hostedConfigured(testnet, 'fixture')); expect(env.tone).toBe(testnet ? 'live' : 'warn') }
    expect(environment(status, 'offline').full).toContain(state === 'ended' ? 'ended' : 'offline')
  }
})
it('rejects planted drift for every rule', () => {
  for (const [rule, code, file] of [
    ['font', 'body{font-family:Arial}', 'broken.css'],
    ['font', '@font-face{font-family:Geist;src:url(https://fonts.example/a.woff2)}', 'broken.css'],
    ['font', '@import "https://fonts.example/geist.css";', 'broken.css'],
    ['heading', 'h1{font-weight:700}', 'broken.css'],
    ['heading', '<h1 style={{fontWeight:700}}>Heading</h1>', 'broken.tsx'],
    ['eyebrow', '.eyebrow{text-transform:uppercase}', 'broken.css'],
    ['environment', '<span>Testnet sandbox · no real value</span>', 'broken.html'],
    ['environment', '<span>Shared XRPL Testnet demo</span>', 'broken.html'],
    ['money', '<p>S$0.5</p>', 'broken.tsx'],
    ['money', 'const price = `S$${(minor/100).toFixed(2)}`', 'broken.ts'],
    ['hash', '<p>ABCDEF…1234</p>', 'broken.tsx'],
    ['hash', 'const short = `${hash.slice(0,8)}…${hash.slice(-8)}`', 'broken.ts'],
    ['date', '<time>{receipt.settledAt}</time>', 'broken.tsx'],
    ['date', '<p>Snapshot 2026-11-11</p>', 'broken.html'],
    ['date', '<p>{row.date}</p>', 'broken.tsx'],
    ['date', 'const label = `Date: ${row.date}`', 'broken.js'],
    ['date', 'const date = new Date().toLocaleDateString()', 'broken.ts'],
  ]) expect(presentationDrift(code, file).some(v => v.rule === rule), `${rule}: ${code}`).toBe(true)
})
