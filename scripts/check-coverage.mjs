import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const roots = ['server', 'shared', 'publisher', 'sdk', 'mcp', 'src', 'desktop']
export function productFiles(root = '.') {
  const walk = dir => readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap(entry => {
    const path = dir + '/' + entry.name
    if (entry.isDirectory()) return ['node_modules', 'dist', 'out'].includes(entry.name) ? [] : walk(path)
    return /\.(ts|tsx|mjs)$/.test(path) && !/\.d\.ts$|\.test\.|desktop\/build\.mjs/.test(path) ? [path] : []
  })
  return roots.flatMap(walk).sort()
}
export function component(path) {
  if (/(?:purchases|challenges|escrow|xrpl|x402|spend-policy|payee-screening|admission|store|agent-keys|issued-currency|asset)\./.test(path) || path.startsWith('server/hire/') || /publisher\/(?:facilitator|journal|refund)/.test(path)) return 'payments'
  if (path.startsWith('server/agents/') && /(?:llm|clef|openai-decisions|provider-retry)\./.test(path)) return 'providers'
  return ({ src: 'web', sdk: 'sdk', mcp: 'mcp', publisher: 'publisher', desktop: 'desktop', shared: 'shared', server: 'server' })[path.split('/')[0]]
}
export function summarize(raw, files, root = process.cwd()) {
  const normalized = Object.fromEntries(Object.entries(raw).map(([path, value]) => [relative(root, path).replaceAll('\\', '/'), value]))
  const groups = {}
  for (const path of files) {
    const entry = normalized[path]
    if (!entry) throw new Error('Missing product file: ' + path)
    const group = groups[component(path)] ??= { branches: { covered: 0, total: 0 }, lines: { covered: 0, total: 0 } }
    for (const metric of ['branches', 'lines']) {
      group[metric].covered += entry[metric].covered
      group[metric].total += entry[metric].total
    }
  }
  return groups
}
export function enforce(groups, floors) {
  for (const [name, expected] of Object.entries(floors)) {
    if (!groups[name]) throw new Error('Missing component: ' + name)
    for (const metric of ['branches', 'lines']) {
      const actual = groups[name][metric], baseline = expected[metric]
      // Cross multiplication preserves the exact baseline rather than rounded percentages.
      if (!actual.total || actual.covered * baseline.total < baseline.covered * actual.total) throw new Error(name + ' ' + metric + ' regressed')
    }
  }
  if (groups.payments.branches.covered * 100 < groups.payments.branches.total * 85) throw new Error('payments branches below 85%')
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = productFiles()
  const groups = summarize(JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8')), files)
  const evidence = 'docs/evidence/round2-b/'
  const report = { sha: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), runner: process.platform + '/' + process.arch + ' ' + process.version, components: groups }
  if (process.argv.includes('--baseline')) {
    writeFileSync(evidence + 'coverage-baseline.json', JSON.stringify(report, null, 2) + '\n')
    writeFileSync(evidence + 'component-map.json', JSON.stringify(Object.fromEntries(files.map(path => [path, component(path)])), null, 2) + '\n')
  } else {
    const baseline = JSON.parse(readFileSync(evidence + 'coverage-baseline.json', 'utf8'))
    const floorsPath = evidence + 'coverage-floors.json'
    enforce(groups, existsSync(floorsPath) ? JSON.parse(readFileSync(floorsPath, 'utf8')) : baseline.components)
    if (process.argv.includes('--record')) writeFileSync(evidence + 'coverage-final.json', JSON.stringify(report, null, 2) + '\n')
  }
  console.log(JSON.stringify(groups, null, 2))
}
