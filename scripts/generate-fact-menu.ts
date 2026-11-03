// Offline only: annotate the existing synthetic articles, preserving prose and versions.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deriveFactMenu } from '../shared/fact-menu.js'
import { ArticleSchema } from '../shared/contracts/writers.js'

const root = 'data/corpus/v2/articles'
let paid = 0
for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.json')) continue
  const file = join(entry.parentPath, entry.name)
  const original = JSON.parse(readFileSync(file, 'utf8'))
  const article = ArticleSchema.parse(original)
  if (article.tier !== 'PAID') continue
  writeFileSync(file, JSON.stringify({ ...original, factMenu: deriveFactMenu(article) }, null, 2) + '\n')
  paid++
}
console.log(`Authored fact menus for ${paid} synthetic paid articles; no provider calls.`)
