import { readFileSync } from 'node:fs'

const files = ['src/App.tsx', 'src/styles.css', 'server/index.ts']
const source = files.map((file) => readFileSync(file, 'utf8')).join('\n')
const checks = [
  [/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/, 'native browser dialog'],
  [/href\s*=\s*["']#/, 'false hash link'],
  [/<(?:div|span|section|p)[^>]+onClick\s*=/, 'non-semantic clickable element'],
]
const findings = checks.filter(([pattern]) => pattern.test(source)).map(([, label]) => label)
if (findings.length) {
  console.error(`FairCut lint failed: ${findings.join(', ')}`)
  process.exit(1)
}
console.log(`FairCut lint passed: ${files.length} source files checked`)
