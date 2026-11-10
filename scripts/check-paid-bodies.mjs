import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Keep this list narrow: ledger terminology and reader-facing API field names are valid.
export const internalBodyPatterns = [
  ['repository path', /\b(?:src|server|shared|publisher|packages|scripts|tests|eval|docs|data|desktop|mcp|sdk)\/[\w.:/-]*/i],
  ['source filename', /\b[\w-]+\.(?:tsx?|jsx?|mjs|cjs|md|jsonl?|py|sql)\b/i],
  ['internal storage', /\b(?:SQLite|outbox(?:es)?|node_modules|reservedMinor|proofOk)\b/i],
  ['engineering annotation', /\bCode:\s|\b0600\b|\bsigned\s+(?:transaction\s+)?blob\b/i],
]

export function paidBodyFindings(articles) {
  return articles.filter(article => article.tier === 'PAID').flatMap(article =>
    [article.body, ...(article.passages ?? []).map(p => p.text)].flatMap((body, index) =>
      internalBodyPatterns.flatMap(([rule, pattern]) => {
        const match = pattern.exec(body ?? '')
        return match ? [{ articleId: article.articleId, section: index ? `passage ${index}` : 'body', rule, match: match[0] }] : []
      })))
}

export function readPaidArticles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = join(root, entry.name)
    if (entry.isDirectory()) return readPaidArticles(file)
    if (!entry.name.endsWith('.json') || entry.name === 'embeddings.json') return []
    const data = JSON.parse(readFileSync(file, 'utf8'))
    return Array.isArray(data) ? data : data.articles ?? (data.articleId ? [data] : [])
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const articles = readPaidArticles(resolve('data/corpus/v2/articles'))
  const findings = paidBodyFindings(articles)
  for (const finding of findings) console.error(JSON.stringify(finding))
  console.log(`Paid-body lint: ${articles.filter(a => a.tier === 'PAID').length} articles, ${findings.length} internal-text violations`)
  if (findings.length) process.exitCode = 1
}
