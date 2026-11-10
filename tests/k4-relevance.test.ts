import { expect, it } from 'vitest'
import { expandProtocolQuery, isProtocolQuery, topicMatches } from '../shared/relevance.js'
import { buildIndex, searchIndex } from '../publisher/search.js'
import { miniCorpus } from './fixtures/corpus-mini/index.js'
import { summarizeAnswer } from '../shared/answer-summary.js'
import { exampleAnswer, exampleCandidate, exampleContent, exampleRun } from '../shared/contracts/examples.js'
import { decide, FixtureDecisionProvider } from '../server/agents/decision.js'
import { declineSummary } from '../shared/decline.js'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import Answer from '../src/components/Answer.js'
import AnchorStatus from '../src/components/AnchorStatus.js'
import ChatThread from '../src/components/ChatThread.js'
import { findingText } from '../shared/finding-text.js'
import { leadFinding } from '../shared/lead-finding.js'
import Passage from '../src/components/Passage.js'
it('documents a small glossary and retrieves challenge and injection synonyms without embeddings', async () => {
 const base=miniCorpus.articles[0]
 const articles=[{...base,articleId:'challenge',title:'x402 payment-required challenge headers',tags:['x402','payment-required'],abstract:'HTTP payment challenge anatomy.',body:'The server returns a payment-required header.'},{...base,articleId:'safety',title:'Where should agent spending controls live?',tags:['authorization','spending-controls'],abstract:'Wallet authorization boundaries.',body:'Deterministic authorization protects wallets.'}]
 const index=await buildIndex(articles)
 expect(expandProtocolQuery('x402 402 response')).toContain('payment-required')
 expect(expandProtocolQuery('What did the central bank change?')).not.toContain('decentralized identifier')
 expect(isProtocolQuery('What did the central bank change?')).toBe(false)
 expect(expandProtocolQuery('Which transaction sets a DID?')).toContain('DIDSet')
 expect(topicMatches('Which transaction sets a DID?', 'DIDSet transactions')).toBe(true)
 expect(expandProtocolQuery('automated market maker deposit')).toContain('AMMDeposit')
 expect((await searchIndex(index,'What does an x402 402 response contain?',5)).ranked[0]?.articleId).toBe('challenge')
 expect((await searchIndex(index,'How can I stop a prompt-injected AI agent from draining its wallet?',5)).ranked[0]?.articleId).toBe('safety')
})
it.each(['Who won the 2026 Singapore Grand Prix?','Which Singapore banks have the best fixed deposit rate?','What should I visit in Tokyo this spring?','Who won the World Cup?','What is a recipe for rice?'])('rejects unrelated evidence and purchase even at maximum model confidence: %s',async question=>{
 const candidate={...exampleCandidate,title:'Singapore company filing and Tokyo office',facets:['Singapore','Tokyo','company','filing'],tier:'PAID' as const,price:{amountMinor:30,currency:'SGD' as const},authority:2,relevance:1}
 const provider=new FixtureDecisionProvider(); provider.judgeCandidate=async()=>({addressesGap:1,credibility:2,originality:{original:1,rewrite:0,overlap:0}})
 const result=await decide({question,gap:question,conclusion:'',candidates:[candidate],readSources:[],budgetMinor:200,spentMinor:0,reservedMinor:0,perSourceCapMinor:100,round:1,provider})
 expect(result.selectedResourceId).toBeUndefined()
 expect(summarizeAnswer(question,exampleAnswer,[exampleContent],[candidate]).lead).toEqual([])
})
it('does not buy spending-controls evidence for payment finality',async()=>{
 expect(topicMatches('When is an XRP payment actually final?', 'Where should agent spending controls live? authorization wallet budget')).toBe(false)
 expect(topicMatches('When is an XRP payment actually final?', 'XRPL validated ledger settlement finality')).toBe(true)
 const provider=new FixtureDecisionProvider(); provider.judgeCandidate=async()=>({addressesGap:1,credibility:2,originality:{original:1,rewrite:0,overlap:0}})
 const candidate={...exampleCandidate,title:'Where should XRPL agent spending controls live?',facets:['XRPL','authorization','wallet','budget'],tier:'PAID' as const,price:{amountMinor:30,currency:'SGD' as const},authority:2,relevance:1}
 const result=await decide({question:'When is an XRP payment actually final?',gap:'When is an XRP payment actually final?',requirement:true,conclusion:'',candidates:[candidate],readSources:[],budgetMinor:200,spentMinor:0,reservedMinor:0,perSourceCapMinor:100,round:1,provider})
 expect(result.selectedResourceId).toBeUndefined()
})

it('leads with the requested field instead of the transaction already named in the question',()=>{
 const texts=['StreamCreate creates a Stream for its specified receiver.','ReleaseAfter sets the earliest release time.']
 const content={...exampleContent,title:'StreamCreate fields',body:texts.join(' '),spans:texts.map((text,i)=>({id:`p${i}`,text}))}
 const candidate={...exampleCandidate,title:content.title,facets:['StreamCreate','fields']}
 expect(summarizeAnswer('Which StreamCreate field limits the release time?',exampleAnswer,[content],[candidate]).lead?.[0].text).toBe(texts[1])
})
it('binds a following answer sentence to the entity in its verified passage',()=>{
 const body='The North Harbor Council met in September 2026. Members voted to raise the service rate by 25 bp.'
 const content={...exampleContent,title:'September decision',body,spans:[{id:'p1',text:body}]}
 const candidate={...exampleCandidate,title:content.title,facets:['meeting','rates']}
 expect(summarizeAnswer('What did the North Harbor Council change at its last meeting?',exampleAnswer,[content],[candidate]).lead?.[0].text).toBe('Members voted to raise the service rate by 25 bp.')
 expect(summarizeAnswer('What did the South Valley Council change at its last meeting?',exampleAnswer,[content],[candidate]).lead).toEqual([])
})
it('accepts descriptive questions through a matching protocol topic rather than generic prose',()=>{
 expect(topicMatches('Which EscrowCreate field returns the money if the receiver never finishes?', 'XRPL conditional escrow EscrowCancel refund')).toBe(true)
 expect(topicMatches('What transaction cost does the XRP Ledger charge for a small transfer?', 'XRPL transaction fees and drops')).toBe(true)
 expect(topicMatches('Which public WebSocket address connects my client to XRPL Testnet?', 'XRPL public endpoint connection settings')).toBe(true)
})
it('leads a causal question with the cause instead of a fee caveat, preserving exact bytes',()=>{
 const texts=['The wallet transaction fee is separate from the trust line cost.','A trust line increases the owner reserve because it adds an owned ledger object.']
 const content={...exampleContent,title:'XRP trust line reserves',body:texts.join(' '),spans:texts.map((text,i)=>({id:`p${i}`,text}))}
 const candidate={...exampleCandidate,title:content.title,facets:['trust line','owner reserve'],tier:'PAID' as const}
 const answer=summarizeAnswer('Why does a trust line make a wallet need more XRP than just the transaction fee?',exampleAnswer,[content],[candidate])
 expect(answer.lead?.[0].text).toBe(texts[1])
})
it('keeps numbers under Why and never renders an empty Why',()=>{
 const run={...exampleRun,phase:'DONE' as const,candidates:[],contents:[],answers:[],decisions:[{round:1,gap:'',threshold:0.2,gapMaterial:1,rows:[],provider:'fixture' as const,model:'test'}]}
 const html=renderToStaticMarkup(createElement(Answer,{run,view:'latest',onView:()=>{},compare:false,onCompare:()=>{}}))
 expect(html).not.toContain('Why ▸');expect(html).toContain('No source covers')
 expect(declineSummary(exampleRun)).not.toMatch(/0\.\d|threshold|policy/)
})
it('uses terminal heading and a pending anchor label, and hides fixture model IDs',()=>{
 const run={...exampleRun,phase:'STOPPED' as const}
 const html=renderToStaticMarkup(createElement(Answer,{run,view:'latest',onView:()=>{},compare:false,onCompare:()=>{}}))
 expect(html).toContain('Partial answer · stopped');expect(html).not.toContain('Draft ·')
 const pending=renderToStaticMarkup(createElement(AnchorStatus,{run:{...run,phase:'ANSWER',labels:{...run.labels,settlement:'XRPL TESTNET · no real value'}}}))
 expect(pending).toContain('follows when research finishes');expect(pending).not.toContain('unavailable')
 const chat=renderToStaticMarkup(createElement(ChatThread,{messages:[{id:1,question:'hi',reply:'Hi',label:'fixture · scope-fixture'}],onSend:()=>{}}))
 expect(chat).toContain('Demo reply');expect(chat).not.toContain('scope-fixture')
})
it('cleans display markers while leaving source bytes to callers',()=>{
 expect(findingText('## A finding [1] [2].')).toBe('A finding.')
})
it('keeps a lowercase conditional premise when an authority prefix is removed',()=>{
 const text='According to the source, if a Stream does not satisfy every required permission and timing constraint for this particular account and asset combination then the transaction remains blocked for that account, because the network must check the entire condition before allowing it to proceed in the same validated ledger.'
 const claim={...exampleAnswer.claims[0],text}
 expect(leadFinding('Which transaction allows a Stream?', [claim])).toEqual([])
})
it('shows the clean cited passage with the full source under a separate disclosure',()=>{
 const text='## The Stream limit is **12** objects [1].'
 const content={...exampleContent,body:`Introductory material. ${text} Other material.`,spans:[{id:'p1',text}]}
 const candidate={...exampleCandidate,tier:'FREE' as const}
 const citation={profileId:content.profileId,resourceId:content.resourceId,version:content.version,spanId:'p1'}
 const html=renderToStaticMarkup(createElement(Passage,{candidate,content,citation,onClose:()=>{}}))
 expect(html).toContain('<mark>The Stream limit is 12 objects.</mark><details>')
 expect(html).toContain('<summary>Read full source</summary>')
 expect(content.body).toContain('**12**')
})

it('bounds a malformed single-token lead and conclusion without changing the delivered bytes',()=>{
 const text='XRP '+ 'x'.repeat(47000)+'.'
 const content={...exampleContent,title:'XRP',body:text,spans:[{id:'p1',text}]}
 const answer=summarizeAnswer('What is XRP?',exampleAnswer,[content],[{...exampleCandidate,title:'XRP'}])
 expect(answer.lead).toEqual([]);expect(answer.conclusion.length).toBeLessThan(1800)
 expect(content.body).toBe(text)
})

it.each([
 ['Which transaction cancels a Stream?', 'CancelStream cancels a Stream before it is finished.'],
 ['How many objects can a Stream contain?', 'A Stream can contain 12 objects.'],
 ['When was the Stream feature enabled?', 'The Stream feature was enabled on 1 October 2026.'],
 ['Is the Stream feature enabled?', 'The Stream feature is enabled for compatible accounts.'],
])('matches requested answer type: %s',(question,text)=>{
 const body='This article introduces the Stream feature. '+text
 const content={...exampleContent,title:'Stream transactions and limits',body,spans:[{id:'p1',text:body}]}
 const candidate={...exampleCandidate,title:content.title,facets:['Stream','transactions','limits']}
 expect(summarizeAnswer(question,exampleAnswer,[content],[candidate]).lead?.[0].text).toBe(text)
})
