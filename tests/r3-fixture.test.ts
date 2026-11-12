import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'
import {assertNoLeaks,canary} from './scenarios/harness.js'
import type {Article,WriterCorpus} from '../shared/contracts/writers.js'
const article=JSON.parse(readFileSync('data/corpus/v2/articles/team-xrpl-explainers/c5-xrpl-destination-tag.json','utf8')) as Article
const corpus=(a:Article):WriterCorpus=>({publishers:[],writers:[],articles:[a]})
it('removes the observed public-answer collisions in the paid fixture while retaining strict leak detection',()=>{
 const publicPhrases=['the beneficiary or destination for a payment a','tag it is not immediately obvious which customer']
 const old={...article,body:publicPhrases.join('\n'),passages:publicPhrases.map((text,i)=>({id:`p${i}`,text}))}
 for(const raw of publicPhrases){
  expect(()=>assertNoLeaks([{kind:'public answer',raw,grants:[]}],corpus(old))).toThrow('before its run/version grant')
  expect(()=>assertNoLeaks([{kind:'public answer',raw,grants:[]}],corpus(article))).not.toThrow()
 }
 expect(article.body).toContain(canary(article.articleId))
 for(const raw of [canary(article.articleId),article.passages[0].text]){
  expect(()=>assertNoLeaks([{kind:'actual premium bytes',raw,grants:[]}],corpus(article))).toThrow('before its run/version grant')
 }
})

it('retains strict markers after the observed crypto-condition public-answer collision',()=>{
 const a=JSON.parse(readFileSync('data/corpus/v2/articles/team-xrpl-explainers/c5-xrpl-crypto-condition-type.json','utf8')) as Article
 for(const raw of ['is the previously supplied preimage sha 256 crypto','conditions are met the escrow object is destroyed'])expect(()=>assertNoLeaks([{kind:'public',raw,grants:[]}],corpus(a))).not.toThrow()
 expect(a.body).toContain(canary(a.articleId))
 expect(()=>assertNoLeaks([{kind:'paid',raw:a.passages[2].text,grants:[]}],corpus(a))).toThrow()
 expect(()=>assertNoLeaks([{kind:'canary',raw:canary(a.articleId),grants:[]}],corpus(a))).toThrow()
})

it('disambiguates the observed fill-or-kill phrase and detects actual paid text',()=>{
 const a=JSON.parse(readFileSync('data/corpus/v2/articles/team-xrpl-explainers/c5-offercreate-flags.json','utf8')) as Article
 expect(()=>assertNoLeaks([{kind:'public',raw:'cancels the offer if it cannot be fully',grants:[]}],corpus(a))).not.toThrow()
 expect(a.body).toContain(canary(a.articleId))
 for(const raw of [a.passages[2].text,canary(a.articleId)])expect(()=>assertNoLeaks([{kind:'paid',raw,grants:[]}],corpus(a))).toThrow()
})

it('disambiguates the observed currency-code phrase without permitting premium bytes',()=>{
 const a=JSON.parse(readFileSync('data/corpus/v2/articles/team-xrpl-explainers/c5-rlusd-currency-code.json','utf8')) as Article
 expect(()=>assertNoLeaks([{kind:'public',raw:'code most interfaces that read currency codes convert',grants:[]}],corpus(a))).not.toThrow()
 expect(a.body).toContain(canary(a.articleId))
 for(const raw of [a.passages[1].text,canary(a.articleId)])expect(()=>assertNoLeaks([{kind:'paid',raw,grants:[]}],corpus(a))).toThrow()
})
