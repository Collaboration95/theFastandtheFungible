import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { build } from 'esbuild'
import { resolve, relative, dirname } from 'node:path'

// Only public source assets enter the portable runtime; never copy operator state.
const out = resolve('dist/mcpb')
execFileSync('python3', ['-c', 'import shutil,sys; shutil.rmtree(sys.argv[1], ignore_errors=True)', out])
mkdirSync(out, { recursive: true })
for (const dir of ['corpus', 'writers', 'calibration']) cpSync(`data/${dir}`, `${out}/data/${dir}`, { recursive: true })
cpSync('LICENSE', `${out}/LICENSE`)
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const manifest = JSON.parse(readFileSync('mcp/manifest.json', 'utf8'))
manifest.version = pkg.version
writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2))
writeFileSync(`${out}/package.json`, JSON.stringify({ name: 'researchagent-mcp', version: pkg.version, type: 'module', dependencies: {} }))
// Each entry stays at its original depth. Rebase module URLs before bundling so
// worker, corpus and app paths retain their source semantics even in chunks.
for (const [entry, target] of [
  ['shared/startup-plan.ts', 'shared/startup-plan.js'], ['mcp/server.ts', 'mcp/server.js'], ['mcp/app.ts', 'mcp/app.js'],
  ['mcp/try.ts', 'mcp/try.js'], ['scripts/publish-site.ts', 'scripts/publish-site.js'],
  ['server/engine-worker.mjs', 'server/engine-worker.mjs'], ['scripts/verify-answer.ts', 'scripts/verify-answer.js'],
]) {
  await build({ entryPoints: [entry], outfile: `${out}/${target}`, bundle: true, platform: 'node', format: 'esm', target: 'node22', minify: true,
    external: ['@playwright/test'],
    banner: { js: "import { createRequire as __raRequire } from 'node:module'; const require = __raRequire(import.meta.url);" },
    plugins: [{ name: 'portable-paths', setup(b) { b.onLoad({ filter: /\.(ts|mjs)$/ }, async ({ path }) => {
      if (path.includes('/node_modules/')) return
      let contents = readFileSync(path, 'utf8')
      if (path.endsWith('/server/engine-worker.mjs')) contents = contents.replace("import { register } from 'tsx/esm/api'", '').replace('register()', '')
      const sourceUrl = relative(dirname(resolve(target)), path).replaceAll('\\', '/')
      contents = contents.replaceAll('import.meta.url', `new URL(${JSON.stringify(sourceUrl)}, import.meta.url).href`)
      return { contents, loader: path.endsWith('.ts') ? 'ts' : 'js' }
    }) } }],
  })
}
writeFileSync(`${out}/mcp/extension.mjs`, readFileSync('mcp/extension.mjs', 'utf8').replaceAll('../shared/startup-plan.ts', '../shared/startup-plan.js').replaceAll('./server.ts', './server.js').replaceAll('./try.ts', './try.js'))
execFileSync('node_modules/.bin/mcpb', ['validate', `${out}/manifest.json`], { stdio: 'inherit' })
execFileSync('node_modules/.bin/mcpb', ['pack', out, resolve('dist/ResearchAgent.mcpb')], { stdio: 'inherit' })
const { createHash } = await import('node:crypto')
const metadata = JSON.parse(readFileSync('server.json', 'utf8'))
metadata.version = pkg.version
metadata.packages[0].identifier = `https://github.com/Collaboration95/theFastandtheFungible/releases/download/v${pkg.version}/ResearchAgent.mcpb`
metadata.packages[0].fileSha256 = createHash('sha256').update(readFileSync('dist/ResearchAgent.mcpb')).digest('hex')
writeFileSync('dist/server.json', JSON.stringify(metadata, null, 2) + '\n')
