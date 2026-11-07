// This is compilation/bootstrap evidence, not a packaged/native app acceptance.
import { readFileSync, writeFileSync, mkdirSync, symlinkSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { newScope, command, fixtureEnv } from './local-gate.mjs'

export function loaderPrefix(source) {
  const marker = /const\s+\{\s*ResourceScope\s*\}\s*=\s*await import\(['"]\.\.\/shared\/resource-scope\.ts['"]\);?/
  const match = marker.exec(source)
  if (!match) throw Error('Desktop loader bootstrap changed; review smoke boundary')
  // Execute the actual entry's registration and first TypeScript import. Do not
  // inherit --import tsx: it would conceal #395's broken bootstrap.
  return source.slice(0, match.index + match[0].length) + '\nconst probe = new ResourceScope(); probe.tempDir("ra-loader-proof-"); await probe.close(); console.log("loader bootstrap passed");\n'
}

export function buildPrefix(source) {
  const boundary = "execFileSync('npm', ['ci', '--omit=dev'"
  const index = source.indexOf(boundary)
  if (index < 0 || !source.slice(0, index).includes("['server', 'publisher', 'shared'")) throw Error('Desktop build staging changed; review smoke boundary')
  return source.slice(0, index)
}

export async function smoke(mode, root = process.cwd()) {
  if (!['loader', 'build'].includes(mode)) throw Error('Usage: node scripts/local-gate-smoke.mjs loader|build')
  const scope = await newScope(), scratch = scope.tempDir('ra-local-gate-smoke-')
  const env = fixtureEnv(scratch)
  try {
    if (mode === 'loader') {
      const stage = scope.tempDir('ra-local-gate-loaders-')
      symlinkSync(resolve(root, 'shared'), join(stage, 'shared'), 'dir')
      symlinkSync(resolve(root, 'node_modules'), join(stage, 'node_modules'), 'dir')
      for (const file of ['desktop/smoke.mjs', 'desktop/recovery-smoke.mjs', 'desktop/accept.mjs', 'scripts/record.mjs', 'scripts/mcp-demo.mjs']) {
        const target = join(stage, file)
        mkdirSync(resolve(target, '..'), { recursive: true })
        writeFileSync(target, loaderPrefix(readFileSync(join(root, file), 'utf8')))
        const result = await command(scope, process.execPath, [target], { cwd: root, env, timeoutMs: 30000 })
        if (result.code !== 0 || result.timedOut) throw Error(`${file}: ${result.tail}`)
        console.log(`${file}: actual loader bootstrap passed (no Electron/Keychain launched)`)
      }
    } else {
      // Run the production build's exact compile/stage prefix. Deliberately stop
      // at dependency installation: reuse already installed deps, no DMG/signing.
      const target = join(scope.tempDir('ra-local-gate-build-'), 'stage.mjs')
      symlinkSync(resolve(root, 'node_modules'), join(resolve(target, '..'), 'node_modules'), 'dir')
      writeFileSync(target, buildPrefix(readFileSync(join(root, 'desktop/build.mjs'), 'utf8')))
      const built = await command(scope, process.execPath, [target], { cwd: root, env, timeoutMs: 480000 })
      if (built.code !== 0 || built.timedOut) throw Error(`Desktop staging: ${built.tail}`)
      console.log(built.tail)
      for (const file of ['shared/resource-scope.js', 'server/engine.js', 'server/engine-worker.mjs', 'desktop/main.mjs']) if (!existsSync(join(root, 'desktop/dist', file))) throw Error(`Desktop staging omitted ${file}`)
      const compiled = join(root, 'desktop/dist')
      const proof = `const {ResourceScope}=await import(${JSON.stringify(pathToFileURL(join(compiled, 'shared/resource-scope.js')).href)});const scope=new ResourceScope();const data=scope.tempDir('ra-desktop-build-engine-');try{const {startEngine}=await import(${JSON.stringify(pathToFileURL(join(compiled, 'server/engine.js')).href)});const engine=await startEngine({dataDir:data});scope.own(engine);for(const url of [engine.apiUrl,engine.publisherUrl]){if([5100,8788,8790].includes(Number(new URL(url).port)))throw Error('Reserved port');const r=await fetch(url+'/health');if(!r.ok)throw Error('Fixture health failed');}console.log('Compiled desktop fixture engine booted; ephemeral API/publisher; ResourceScope loaded');}finally{await scope.close();}`
      const proofFile = join(resolve(target, '..'), 'fixture-engine.mjs')
      writeFileSync(proofFile, proof)
      const result = await command(scope, process.execPath, [proofFile], { cwd: compiled, env, timeoutMs: 120000 })
      if (result.code !== 0 || result.timedOut) throw Error(`Compiled desktop engine: ${result.tail}`)
      console.log(result.tail)
      console.log('Desktop compile/stage + fixture engine smoke passed; production install, Electron, DMG and Keychain remain acceptance checks')
    }
  } finally { await scope.close() }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) smoke(process.argv[2]).catch(error => { console.error(String(error)); process.exitCode = 1 })
