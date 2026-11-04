import { build as electronBuild } from 'electron-builder'
import { transform } from 'esbuild'
import { readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve, dirname, join } from 'node:path'

const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const stage = resolve('desktop/dist')
const version = process.env.DESKTOP_VERSION || pkg.version
if (!/^\d+\.\d+\.\d+(?:-rc\.[1-9]\d*)?$/.test(version)) throw new Error('Invalid desktop version')
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' })
await rm(stage, { force: true, recursive: true })
await mkdir(stage, { recursive: true })
for (const folder of ['server', 'publisher', 'shared', 'mcp', 'sdk', 'eval/decisions']) {
  for (const entry of await readdir(folder, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue
    const source = join(entry.parentPath, entry.name)
    const destination = join(stage, source.replace(/\.ts$/, '.js'))
    let { code } = await transform(await readFile(source, 'utf8'), { loader: 'ts', format: 'esm', target: 'node24' })
    // Reports retain the existing HTML fallback; no second Chromium download in the app.
    code = code.replace('from "@playwright/test"', 'from "../../desktop/report-renderer.mjs"')
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, code)
  }
}
await mkdir(join(stage, 'desktop'), { recursive: true })
for (const name of ['recovery.mjs', 'recovery.html', 'recovery.js', 'updates.mjs', 'main.mjs', 'backend.mjs', 'policy.mjs', 'keychain.mjs', 'engine-host.mjs', 'preload.cjs', 'preferences.html', 'preferences.js', 'preferences.css', 'mcp.mjs']) await cp(`desktop/${name}`, join(stage, 'desktop', name))
// Compile the shared worker, retaining its startup, auth and shutdown contract.
// The desktop adds only its local Host/Origin and pause boundary.
let worker = await readFile('server/engine-worker.mjs', 'utf8')
worker = worker.replace("import { register } from 'tsx/esm/api'", "import { createServer } from 'node:http'\nimport { localRequest } from '../desktop/policy.mjs'")
worker = worker.replace('register()', '').replace(/\.ts(['"])/g, '.js$1')
const listener = "api.app.listen(workerData.apiPort, '127.0.0.1')"
if (!worker.includes(listener)) throw new Error('Shared worker listener changed; review desktop boundary')
worker = worker.replace(listener, `createServer((req, res) => {
    if (!localRequest(req, req.socket.localPort)) {
      res.writeHead(403); res.end(); return
    }
    api.app(req, res)
  }).listen(workerData.apiPort, '127.0.0.1')`)
await writeFile(join(stage, 'server/engine-worker.mjs'), worker)
await writeFile(join(stage, 'desktop/report-renderer.mjs'), "export const chromium = { launch: async () => { throw new Error('Desktop uses HTML print fallback') } }\n")
await cp('dist', join(stage, 'ui'), { recursive: true })
// Only public synthetic corpus input, never databases, reports, env files or calibration output.
for (const folder of ['writers', 'corpus/v2']) await cp(`data/${folder}`, join(stage, 'data', folder), { recursive: true, filter: file => !file.endsWith('embeddings.json') })
const roster = (await readdir('data/writers')).filter(name => name.endsWith('.json'))
const walletNames = []
for (const name of roster) {
  const { publisher } = JSON.parse(await readFile(`data/writers/${name}`, 'utf8'))
  if (Object.values(publisher.prices || {}).some(price => price > 0)) walletNames.push(`XRPL_PUBLISHER_${publisher.slug.toUpperCase().replaceAll('-', '_')}_SEED`)
}
await writeFile(join(stage, 'desktop/wallets.json'), JSON.stringify(walletNames))
await writeFile(join(stage, 'package.json'), JSON.stringify({ ...pkg, version, main: 'desktop/main.mjs', scripts: {} }, null, 2))
await cp('package-lock.json', join(stage, 'package-lock.json'))
// Version override is metadata only; lock entry stays in sync for npm ci.
const lock = JSON.parse(await readFile(join(stage, 'package-lock.json'), 'utf8'))
lock.version = version; lock.packages[''].version = version
await writeFile(join(stage, 'package-lock.json'), JSON.stringify(lock))
execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: stage, stdio: 'inherit' })
console.log(`Desktop staged · ${version} · offline default · no .env copied`)
if (!process.argv.includes('--dmg')) process.exit(0)
if (process.platform !== 'darwin') throw new Error('Build the DMG on macOS')
const arch = execFileSync('lipo', ['-archs', 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'], { encoding: 'utf8' }).trim()
if (arch !== (process.env.DESKTOP_ARCH === 'x64' ? 'x86_64' : 'arm64')) throw new Error('Apple Silicon Electron required; rerun desktop/download.mjs with a clean electron/dist')
const signing = process.argv.includes('--sign')
if (signing && process.argv.includes('--unsigned')) throw new Error('Choose --sign or --unsigned')
let identity
if (signing) {
  identity = process.env.CSC_NAME
  if (!identity?.startsWith('Developer ID Application:')) throw new Error('--sign requires explicit CSC_NAME')
  const identities = execFileSync('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' })
  if (!identities.includes('"' + identity + '"')) throw new Error('Signing identity unavailable')
  execFileSync('xcrun', ['notarytool', 'history', '--keychain-profile', 'ra-notary'], { stdio: 'ignore' })
} else {
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
  delete process.env.CSC_LINK; delete process.env.CSC_KEY_PASSWORD; delete process.env.CSC_NAME
  console.log('UNSIGNED BUILD · identity discovery, Developer ID and notarisation disabled')
}
process.env.CUSTOM_DMGBUILD_PATH = resolve('node_modules/.cache/researchagent-dmg/dmgbuild')
await electronBuild({ publish: 'never', targets: undefined, config: {
  appId: 'org.researchagent.desktop', productName: 'ResearchAgent', electronVersion: pkg.devDependencies.electron,
  electronDist: resolve('node_modules/electron/dist'),
  directories: { app: stage, output: resolve('desktop/out'), buildResources: resolve('desktop/build') },
  // A utilityProcess needs a real cwd for the engine's corpus paths; ASAR is virtual.
  files: ['**/*', '!package-lock.json'], asar: false,
  mac: { target: [{ target: 'dmg', arch: [process.env.DESKTOP_ARCH || 'arm64'] }], category: 'public.app-category.productivity', icon: resolve('desktop/build/icon.icns'),
    identity: identity || null, hardenedRuntime: true, entitlements: resolve('desktop/build/entitlements.mac.plist'), entitlementsInherit: resolve('desktop/build/entitlements.mac.plist'), notarize: false },
  afterSign: async context => {
    if (!identity) return
    const appPath = join(context.appOutDir, 'ResearchAgent.app')
    execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, appPath + '.zip'])
    const result = execFileSync('xcrun', ['notarytool', 'submit', appPath + '.zip', '--keychain-profile', 'ra-notary', '--wait', '--output-format', 'json'], { encoding: 'utf8' })
    await rm(appPath + '.zip')
    if (JSON.parse(result).status !== 'Accepted') throw new Error('Notarisation was not accepted')
    execFileSync('xcrun', ['stapler', 'staple', appPath], { stdio: 'inherit' })
    execFileSync('xcrun', ['stapler', 'validate', appPath], { stdio: 'inherit' })
  },
  dmg: { title: 'ResearchAgent', sign: Boolean(identity), contents: [{ x: 140, y: 180 }, { x: 420, y: 180, type: 'link', path: '/Applications' }] },
  artifactName: 'ResearchAgent-${version}-${arch}.${ext}',
} })
