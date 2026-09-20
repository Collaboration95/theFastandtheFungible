#!/usr/bin/env node
// No dependencies, server, environment file, or network required.
import { readFile, readdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const repo = resolve(root, '..')
const errors = []
const required = ['README.md', 'DESIGN-BRIEF.md', 'EVIDENCE.md',
  'IMPLEMENTATION-PLAN.md', 'ORCHESTRATOR-PROMPT.md', 'WORKER-PROMPT.md',
  'TESTING.md', 'STATUS.md', 'assets/manifest.json', 'evidence/RESULT-TEMPLATE.md']
for (const name of required) {
  try { await stat(resolve(root, name)) } catch { errors.push(`Missing required file: ${name}`) }
}

let assets = []
try { assets = JSON.parse(await readFile(resolve(root, 'assets/manifest.json'), 'utf8')) }
catch (error) { errors.push(`Cannot read asset manifest: ${error.message}`) }
if (assets.length !== 11) errors.push(`Expected 11 original assets; found ${assets.length}`)
const seen = new Set()
for (const asset of assets) {
  if (seen.has(asset.id)) errors.push(`Duplicate screenshot ID: ${asset.id}`)
  seen.add(asset.id)
  const path = resolve(root, asset.path)
  if (!path.startsWith(root + sep)) { errors.push(`Asset escapes package: ${asset.path}`); continue }
  try {
    const data = await readFile(path)
    if (data.length !== asset.bytes) errors.push(`Size mismatch: ${asset.path}`)
    if (createHash('sha256').update(data).digest('hex') !== asset.sha256) errors.push(`Hash mismatch: ${asset.path}`)
    if (!data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) errors.push(`Not PNG: ${asset.path}`)
    else if (data.readUInt32BE(16) !== asset.width || data.readUInt32BE(20) !== asset.height) errors.push(`Dimension mismatch: ${asset.path}`)
    const expectedKind = Number(asset.id.slice(1)) <= 9 ? 'current' : 'references'
    if (asset.kind !== expectedKind || !asset.path.startsWith(`assets/${expectedKind}/`)) errors.push(`Wrong evidence category: ${asset.id}`)
  } catch (error) { errors.push(`Asset read failed: ${asset.path}: ${error.message}`) }
}
for (let i = 1; i <= 11; i++) if (!seen.has(`S${String(i).padStart(2, '0')}`)) errors.push(`Missing screenshot S${i}`)

async function markdownFiles(dir) {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) found.push(...await markdownFiles(path))
    else if (entry.name.endsWith('.md')) found.push(path)
  }
  return found
}
const files = [...await markdownFiles(root), resolve(repo, 'docs/UX-REDESIGN-BRIEF-2026-09-20.md')]
let links = 0
for (const file of files) {
  const text = await readFile(file, 'utf8')
  const prose = text.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '')
  if (/\/(?:Users|home)\/[^\s)]+/.test(prose)) errors.push(`Machine-specific home path: ${relative(repo, file)}`)
  for (const match of prose.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].trim().replace(/^<|>$/g, '')
    if (/^(?:https?:|mailto:|#)/.test(target)) continue
    target = decodeURIComponent(target.split('#')[0])
    if (!target) continue
    if (target.startsWith('/') || /^[a-z]+:/i.test(target)) { errors.push(`Nonportable link in ${relative(repo,file)}: ${target}`); continue }
    const path = resolve(dirname(file), target)
    if (path !== repo && !path.startsWith(repo + sep)) { errors.push(`Link escapes repository: ${target}`); continue }
    links++
    try { await stat(path) } catch { errors.push(`Broken link in ${relative(repo,file)}: ${target}`) }
  }
}
for (const name of ['DESIGN-BRIEF.md', 'EVIDENCE.md']) {
  const text = await readFile(resolve(root, name), 'utf8')
  for (const asset of assets) if (!text.includes(`](${asset.path})`)) errors.push(`${name} does not embed ${asset.id}`)
}
if (errors.length) {
  console.error(errors.map(error => `FAIL: ${error}`).join('\n'))
  process.exitCode = 1
} else {
  console.log(`PASS: ${assets.length} original PNGs, hashes/dimensions/categories verified; ${files.length} Markdown files and ${links} relative links checked.`)
  console.log('Package integrity only: application, accessibility, visual quality, and human usability remain separate gates.')
}
