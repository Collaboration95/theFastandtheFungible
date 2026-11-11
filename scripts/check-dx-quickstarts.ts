// Execute the documented code verbatim in empty consumers. GitHub bytes enter only through gh.
import { ResourceScope, waitForOutput } from '../shared/resource-scope.js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import assert from 'node:assert/strict'
const exec = promisify(execFile)
const scope = new ResourceScope()
const root = scope.tempDir('dx-quickstarts-')
const assets = resolve(process.argv[2] || 'dist/release')
// Asset names follow the version being released (package.json), never a hard-coded tag.
const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version
const wheelVersion = version.replace(/-rc\.(\d+)$/, 'rc$1')
const code = (file: string, lang: string) => readFileSync(file, 'utf8').split('```' + lang + '\n')[1].split('```')[0]
const testnetWriter = process.argv.includes('--testnet-writer')
const writerState = testnetWriter ? scope.evidenceDir('dx-writer-', 'Fresh synthetic writer onboarding on XRPL Testnet; retain wallet state for reconciliation') : join(root, 'state')
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, XDG_STATE_HOME: join(root, 'state'), RA_DATA_DIR: join(root, 'engine'), MCP_MAX_BUDGET_MINOR: '200', MCP_DAILY_CAP_MINOR: '500', DEMO_PORT_OFFSET: '1300', DOTENV_CONFIG_PATH: '.no-env', npm_config_cache: join(root, 'npm-cache') }
const run = async (cmd: string, args: string[], cwd: string) => (await exec(cmd, args, { cwd, env, timeout: 180000, maxBuffer: 8 * 1024 * 1024 })).stdout
try {
  const appDir = join(root, 'app'); mkdirSync(appDir)
  const child = scope.spawn('npx', ['-y', 'file:' + join(assets, `researchagent-mcp-${version}.tgz`), 'app', '--port', '6400'], { cwd: appDir, env })
  let output = ''; child.stdout!.on('data', chunk => { output += chunk }); child.stderr!.resume()
  await waitForOutput(child, /ResearchAgent ready:[^\n]+/, 60000)
  const baseUrl = output.match(/Engine baseUrl: (http:\/\/127\.0\.0\.1:\d+)/)?.[1] ?? output.match(/baseUrl: '(http:\/\/127\.0\.0\.1:\d+)'/)?.[1]
  const tokenFile = output.match(/Token file: (.+?) \(private/)?.[1] ?? output.match(/readFileSync\('([^']+)'/)?.[1]
  assert(baseUrl && tokenFile, 'app must print engine URL and private token path')
  for (const [dir, lang, guide, name] of [['ts','js','docs/sdk.md','ask.mjs'], ['py','python','docs/sdk-python.md','ask.py'], ['http','js','docs/api/README.md','ask-http.mjs']]) {
    const cwd = join(root, dir); mkdirSync(cwd)
    writeFileSync(join(cwd, name), code(guide, lang))
    let result: string
    if (dir === 'ts') {
      await run('npm', ['init', '-y'], cwd)
      await run('npm', ['i', join(assets, `researchagent-sdk-${version}.tgz`)], cwd)
      result = await run(process.execPath, [name, baseUrl, tokenFile], cwd)
    } else if (dir === 'py') {
      await run('python3', ['-m', 'venv', '.venv'], cwd)
      const python = join(cwd, '.venv/bin/python')
      await run(python, ['-m', 'pip', 'install', '--no-cache-dir', join(assets, `researchagent-${wheelVersion}-py3-none-any.whl`)], cwd)
      result = await run(python, [name, baseUrl, tokenFile], cwd)
      const cli = await run(python, ['-m','researchagent','verify','receipts.json','--json'], cwd)
      assert.equal(JSON.parse(cli).ok, true)
    } else result = await run(process.execPath, [name, baseUrl, tokenFile], cwd)
    assert.match(result, /ok['"]?: [Tt]rue/)
    assert.match(result, /SIMULATED/)
    console.log(`PASS empty ${dir} consumer: documented ask + labelled receipts + offline verify`)
  }
  const writerDir = join(root, 'writer'); mkdirSync(writerDir)
  const prefix = ['-y', 'file:' + join(assets, `researchagent-mcp-${version}.tgz`)]
  await run('npx', [...prefix, 'init', 'my-notes'], writerDir)
  const publisher = scope.spawn('npx', [...prefix, 'publish', './my-notes', ...(testnetWriter ? ['--testnet'] : ['--rail', 'simulated'])], { cwd: writerDir, env: { ...env, XDG_STATE_HOME: writerState } })
  publisher.stderr!.resume()
  const registration = await waitForOutput(publisher, /Registry (http:\/\/127\.0\.0\.1:\d+)\/registry/, 120000)
  assert.equal((await fetch(registration[1] + '/registry')).status, 200)
  console.log(`PASS empty writer consumer: init then ${testnetWriter ? 'XRPL Testnet publish (synthetic notes, no real value)' : 'simulated publish'}; registry HTTP 200`)
  if (testnetWriter) console.log(`Private Testnet writer state retained for reconciliation: ${writerState}`)
} finally { await scope.close() }
