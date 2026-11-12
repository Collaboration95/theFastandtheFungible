import { existsSync, readFileSync } from 'node:fs'
const phases = ['quote', 'createSubmitted', 'createValidated', 'lockProven', 'finishSubmitted', 'finishValidated', 'unlocked']
const names = ['Quote', 'Create preparation → submit', 'Create submit → validated', 'Validated create → writer lock proof/grant', 'Writer preparation → finish submit', 'Finish submit → validated', 'Key/body verification → unlocked']
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1]
const files = ['before', 'after'].map(label => {
  const path = `docs/evidence/speed/${label}.json`
  if (!existsSync(path)) return
  const { samples } = JSON.parse(readFileSync(path, 'utf8'))
  const rows = [...phases, 'total'].map((phase, i) => {
    const values = samples.map(s => {
      const marks = s.timing.phases
      return phase === 'total' ? marks.unlocked.elapsedMs : marks[phase].elapsedMs - (i ? marks[phases[i - 1]].elapsedMs : 0)
    })
    return [percentile(values, 0.5), percentile(values, 0.9)].map(ms => (ms / 1000).toFixed(3)).join(' / ')
  })
  return { label, n: samples.length, rows }
})
console.log(`| Phase | ${files.map(f => f ? `${f.label} p50 / p90 (s), n=${f.n}` : 'after (pending)').join(' | ')} |`)
console.log('|---|---|---|')
for (let i = 0; i <= phases.length; i++) console.log(`| ${names[i] ?? 'Quote start → verified unlock'} | ${files.map(f => f?.rows[i] ?? 'pending').join(' | ')} |`)
