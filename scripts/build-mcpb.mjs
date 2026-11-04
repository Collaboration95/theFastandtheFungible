import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { transformSync } from 'esbuild'
import { resolve } from 'node:path'
// Explicit source allowlist: never package .env, databases or local wallet data.
const out = resolve('dist/mcpb')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
for (const dir of ['mcp', 'server', 'shared', 'sdk', 'publisher']) cpSync(dir, `${out}/${dir}`, { recursive: true, filter: source => !source.endsWith('.db') })
for (const dir of ['corpus', 'writers', 'calibration']) cpSync(`data/${dir}`, `${out}/data/${dir}`, { recursive: true })
mkdirSync(`${out}/eval/decisions`, { recursive: true })
cpSync('eval/decisions/calibration.ts', `${out}/eval/decisions/calibration.ts`)
cpSync('eval/decisions/metrics.ts', `${out}/eval/decisions/metrics.ts`)
mkdirSync(`${out}/scripts`, { recursive: true })
cpSync('scripts/testnet-wallets.ts', `${out}/scripts/testnet-wallets.ts`)
cpSync('LICENSE', `${out}/LICENSE`)
cpSync('mcp/manifest.json', `${out}/manifest.json`)
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const manifest = JSON.parse(readFileSync('mcp/manifest.json', 'utf8'))
manifest.version = pkg.version
writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2))
// Reuse the exact lockfile dependency graph. No package scripts run.
writeFileSync(`${out}/package.json`, JSON.stringify({ ...pkg, scripts: {}, devDependencies: {} }))
cpSync('package-lock.json', `${out}/package-lock.json`)
execFileSync('npm', ['ci', '--ignore-scripts', '--omit=dev'], { cwd: out, stdio: 'inherit' })
// Existing report generation imports Playwright at startup; ship its JS, no browsers.
for (const name of ['@playwright/test', 'playwright', 'playwright-core']) cpSync(`node_modules/${name}`, `${out}/node_modules/${name}`, { recursive: true })
// Transpile the allowlisted sources; runtime uses plain portable Node ESM.
function compile(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) compile(path)
    else if (entry.name.endsWith('.ts')) {
      writeFileSync(path.slice(0, -3) + '.js', transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'esm', target: 'node22' }).code)
      unlinkSync(path)
    }
  }
}
for (const dir of ['mcp', 'server', 'shared', 'sdk', 'publisher', 'eval', 'scripts']) compile(`${out}/${dir}`)
const worker = `${out}/server/engine-worker.mjs`
writeFileSync(worker, readFileSync(worker, 'utf8').replace("import { register } from 'tsx/esm/api'", '').replace('register()', '').replaceAll('.ts\'', '.js\''))
writeFileSync(`${out}/mcp/extension.mjs`, readFileSync('mcp/extension.mjs', 'utf8').replace('./server.ts', './server.js'))
execFileSync('node_modules/.bin/mcpb', ['validate', `${out}/manifest.json`], { stdio: 'inherit' })
execFileSync('node_modules/.bin/mcpb', ['pack', out, resolve('dist/ResearchAgent.mcpb')], { stdio: 'inherit' })
const { createHash } = await import('node:crypto')
const metadata = JSON.parse(readFileSync('server.json', 'utf8'))
metadata.version = pkg.version
metadata.packages[0].identifier = `https://github.com/Collaboration95/theFastandtheFungible/releases/download/v${pkg.version}/ResearchAgent.mcpb`
metadata.packages[0].fileSha256 = createHash('sha256').update(readFileSync('dist/ResearchAgent.mcpb')).digest('hex')
writeFileSync('dist/server.json', JSON.stringify(metadata, null, 2) + '\n')
