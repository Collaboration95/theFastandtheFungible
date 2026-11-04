import { execFileSync } from 'node:child_process'
import { mkdirSync, cpSync, readFileSync, writeFileSync, statSync, mkdtempSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { pythonVersion } from './release-version.mjs'
import { sha256 } from './release-contract.mjs'
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts })
const out = resolve('dist/release'); mkdirSync(out, { recursive: true })
const python = process.env.RELEASE_PYTHON || 'python3'
const buildEnv = mkdtempSync(join(tmpdir(), 'ra-build-'))
try {
run(python, ['-m', 'venv', buildEnv])
run(join(buildEnv, 'bin/python'), ['-m', 'pip', 'install', 'build'])
run(join(buildEnv, 'bin/python'), ['-m', 'build', '--outdir', out, 'packages/sdk-python'])
const packed = JSON.parse(execFileSync('npm', ['pack', './packages/sdk', '--json', '--pack-destination', out], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }))[0]
run('node', ['scripts/build-mcpb.mjs'])
// Package the same portable runtime, including its locked dependencies.
const mcpRoot = resolve('dist/mcpb')
const mcpPkg = JSON.parse(readFileSync(join(mcpRoot, 'package.json')))
writeFileSync(join(mcpRoot, 'bin.mjs'), '#!/usr/bin/env node\nawait import("./mcp/extension.mjs")\n')
writeFileSync(join(mcpRoot, 'package.json'), JSON.stringify({ name: 'researchagent-mcp', version: mcpPkg.version, type: 'module', engines: {node: '>=22.13'}, bin: { 'researchagent-mcp': './bin.mjs' }, bundledDependencies: Object.keys(mcpPkg.dependencies).concat(['@playwright/test', 'playwright', 'playwright-core']), dependencies: {...mcpPkg.dependencies, '@playwright/test': '*', playwright: '*', 'playwright-core': '*'} }))
const mcpPacked = JSON.parse(execFileSync('npm', ['pack', mcpRoot, '--json', '--pack-destination', out], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }))[0]
for (const name of ['ResearchAgent.mcpb', 'server.json']) cpSync('dist/' + name, join(out, name))
const pkg = JSON.parse(readFileSync('package.json')); const sdk = JSON.parse(readFileSync('packages/sdk/package.json'))
const pyVersion = readFileSync('packages/sdk-python/pyproject.toml', 'utf8').match(/^version = "([^"]+)"/m)[1]
if (pyVersion !== pythonVersion(pkg.version) || sdk.version !== pkg.version) throw Error('Release package versions must agree')
const artifacts = [['mcp-tgz', mcpPacked.filename, pkg.version], ['tgz', packed.filename, sdk.version], ['wheel', `researchagent-${pyVersion}-py3-none-any.whl`, pyVersion], ['sdist', `researchagent-${pyVersion}.tar.gz`, pyVersion], ['mcpb', 'ResearchAgent.mcpb', pkg.version], ['metadata', 'server.json', pkg.version]].map(([kind, file, version]) => ({ kind, file, version, bytes: statSync(join(out, file)).size, sha256: sha256(join(out, file)), acceptance: kind === 'sdist' || kind === 'metadata' ? 'hash only' : 'requires matching clean consumer receipt' }))
writeFileSync(join(out, 'manifest.json'), JSON.stringify({ schema: 1, sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), runtime: { node: process.version, python: execFileSync(python, ['--version'], { encoding: 'utf8' }).trim() }, mode: 'fixture providers; simulated settlement', artifacts }, null, 2) + '\n')

} finally {
  if(process.env.KEEP_CONSUMER_SCRATCH === '1') console.log('Build scratch retained: ' + buildEnv)
  else rmSync(buildEnv,{recursive:true,force:true})
}
