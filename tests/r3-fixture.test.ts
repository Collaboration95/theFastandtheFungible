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
