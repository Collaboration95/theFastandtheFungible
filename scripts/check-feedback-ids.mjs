import { readFileSync } from 'node:fs'
export function checkFeedbackIds(text) {
  const seen = new Set()
  for (const [, id] of text.matchAll(/^\| (B\d+)\s*·/gm)) {
    if (seen.has(id)) throw Error(`Duplicate builder feedback ID: ${id}`)
    seen.add(id)
  }
  if (!seen.size) throw Error('No builder feedback IDs found')
}
checkFeedbackIds(readFileSync('docs/BUILDER-FEEDBACK.md', 'utf8'))
