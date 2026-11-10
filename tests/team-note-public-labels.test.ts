import { it, expect } from 'vitest'
import { publicLabelStrings, paidLabelOverlaps } from '../scripts/public-label-overlap.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { sharesRun, ABSTRACT_LEAK_WORDS } from '../shared/contracts/writers.js'

it('every paid team note avoids every eight-word public label or disclosure sequence', async () => {
 const corpus=await loadWriterCorpus(), labels=publicLabelStrings()
 expect(ABSTRACT_LEAK_WORDS).toBe(8)
 expect(labels.length).toBeGreaterThan(1000)
 expect(labels.some(l=>l.file==='src/components/PaymentRow.tsx' && l.text.includes('This demo writer agrees to refund'))).toBe(true)
 expect(labels.some(l=>l.file==='shared/contracts/asset.ts' && l.text.includes('TEST-SGD'))).toBe(true)
 expect(paidLabelOverlaps(corpus.articles,labels)).toEqual([])
})
it('the unchanged eight-word oracle catches reintroduction of the refund disclosure', async () => {
 const corpus=await loadWriterCorpus(), labels=publicLabelStrings()
 const label=labels.find(l=>l.file==='src/components/PaymentRow.tsx' && l.text.includes('This demo writer agrees to refund'))!
 const recovery=corpus.articles.find(a=>a.articleId==='team-recovery')!
 const contaminated={...recovery,body:recovery.body+' '+label.text}
 expect(sharesRun(contaminated.body,label.text)).toBe(true)
 expect(paidLabelOverlaps([contaminated],labels).some(o=>o.words==='agrees to refund a real writer could refuse')).toBe(true)
})
