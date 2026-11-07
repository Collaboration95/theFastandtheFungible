import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Answer from '../src/components/Answer'
import { offlineZeroBudgetRun } from '../src/fixtures/run'
import { stance } from '../server/agents/research'
import { loadWriterCorpus } from '../publisher/corpus'
it('numeric reductions support a shorter lead-time question despite incidental delay wording', () => {
 expect(stance('Lead times fell from 26 weeks to 18 weeks despite a delay.', 'Are lead times getting shorter?')).toBe('SUPPORTS')
 expect(stance('Lead times moved from 18 weeks to 26 weeks.', 'Are lead times getting longer?')).toBe('SUPPORTS')
 expect(stance('Lead times moved from 18 weeks to 26 weeks.', 'Are lead times getting shorter?')).toBe('CHALLENGES')
})
it('a completed uncited run has an honest answer and publishing link', () => {
 const html=renderToStaticMarkup(<Answer run={{...offlineZeroBudgetRun,phase:'DONE',answers:[],events:[]}} view="latest" onView={()=>{}} compare={false} onCompare={()=>{}} />)
 expect(html).toContain('No listed writer covers this yet · nothing bought');expect(html).toContain('Publish a note on this →');expect(html).not.toContain('is-skel')
})
it('team corpus retains ordinary identity, disclosure and word-limit validation', async()=>{
 const c=await loadWriterCorpus();const p=c.publishers.find(p=>p.slug==='team-builder-notes')!
 expect(p.synthetic).toBe(false);expect(p.verification?.status).toBe('unverified');expect(p.bio).toBe('team-authored · real content · not an independent writer · Testnet')
 expect(c.articles.filter(a=>a.publisherSlug===p.slug)).toHaveLength(8)
})
