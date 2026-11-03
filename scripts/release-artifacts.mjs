import { execFileSync } from 'node:child_process'
import { mkdirSync, cpSync, readFileSync, writeFileSync, statSync, mkdtempSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { sha256 } from './release-contract.mjs'
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts })
const out = resolve('dist/release'); mkdirSync(out, { recursive: true })
const python = process.env.RELEASE_PYTHON || 'python3'
const buildEnv = mkdtempSync(join(tmpdir(), 'ra-build-'))
run(python, ['-m', 'venv', buildEnv])
run(join(buildEnv, 'bin/python'), ['-m', 'pip', 'install', 'build'])
run(join(buildEnv, 'bin/python'), ['-m', 'build', '--outdir', out, 'packages/sdk-python'])
const packed = JSON.parse(execFileSync('npm', ['pack', './packages/sdk', '--json', '--pack-destination', out], { encoding: 'utf8' }))[0]
run('node', ['scripts/build-mcpb.mjs'])
for (const name of ['ResearchAgent.mcpb', 'server.json']) cpSync('dist/' + name, join(out, name))
const pkg = JSON.parse(readFileSync('package.json')); const sdk = JSON.parse(readFileSync('packages/sdk/package.json'))
const pyVersion = readFileSync('packages/sdk-python/pyproject.toml', 'utf8').match(/^version = "([^"]+)"/m)[1]
const artifacts = [['tgz', packed.filename, sdk.version], ['wheel', `researchagent-${pyVersion}-py3-none-any.whl`, pyVersion], ['sdist', `researchagent-${pyVersion}.tar.gz`, pyVersion], ['mcpb', 'ResearchAgent.mcpb', pkg.version], ['metadata', 'server.json', pkg.version]].map(([kind, file, version]) => ({ kind, file, version, bytes: statSync(join(out, file)).size, sha256: sha256(join(out, file)), acceptance: kind === 'sdist' || kind === 'metadata' ? 'hash only' : 'requires matching clean consumer receipt' }))
writeFileSync(join(out, 'manifest.json'), JSON.stringify({ schema: 1, sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), runtime: { node: process.version, python: execFileSync(python, ['--version'], { encoding: 'utf8' }).trim() }, mode: 'fixture providers; simulated settlement', artifacts }, null, 2) + '\n')
