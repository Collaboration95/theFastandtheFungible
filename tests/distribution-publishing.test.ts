import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseMarkdown } from '../publisher/publishing/markdown.js'

it('the published author guide supplies parseable synthetic paid and free first articles', () => {
  const guide = readFileSync('docs/publishing.md', 'utf8')
  const example = guide.match(/```markdown\n([\s\S]*?)```/)![1]
  const paid = parseMarkdown(example, 'new-writer', 'evidence')
  expect(paid).toMatchObject({tier:'PAID',priceMinor:10,synthetic:true})
  const free = parseMarkdown(example.replace('tier: PAID','tier: FREE').replace('price: 0.10','price: 0'), 'new-writer', 'public')
  expect(free).toMatchObject({tier:'FREE',priceMinor:0,synthetic:true})
  // Common copied-document forms retain scalar data rather than executing YAML.
  const copied = example.replace('title: My evidence note', '# author note\ntitle: \'My evidence note\'').replaceAll('\n','\r\n')
  expect(parseMarkdown(copied,'new-writer','quoted').title).toBe(paid.title)
  expect(() => parseMarkdown(example.replace('price: 0.10','price: 99999999999999999999'),'new-writer','overflow')).toThrow('price is too large')
  expect(() => parseMarkdown(example.replace('tags: research, evidence','tags: '+ 'x'.repeat(161)),'new-writer','topics')).toThrow('public topics')
})
