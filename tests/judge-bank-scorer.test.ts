import { describe, expect, it } from 'vitest'
import { answersIt, valueHistograms, type ValueRow } from '../scripts/judge-bank-scorer.js'
const citation = { resourceId: 'paid', version: '1', spanId: 's1' }
const lead = (text: string) => [{ text, citations: [citation] }]
describe('answers-it', () => {
  it('normalises case and whitespace in the first two sentences', () => {
    expect(answersIt('VALIDATED ledger', lead('The outcome is final. It requires a validated\n ledger.'), [citation])).toBe(1)
  })
  it('rejects gold after sentence two', () => {
    expect(answersIt('gold', lead('First sentence. Second sentence. Gold is here.'), [citation])).toBe(0)
    expect(answersIt('gold', lead('First sentence! second sentence! gold is here.'), [citation])).toBe(0)
  })
  it('rejects an uncited or unpurchased lead, including a citation only after sentence two', () => {
    expect(answersIt('gold', [{text:'Gold here.',citations:[]}], [citation])).toBe(0)
    expect(answersIt('gold', lead('Gold here.'), [])).toBe(0)
    expect(answersIt('gold', [{text:'Gold here. Another sentence.',citations:[]}, ...lead('Purchased later.')], [citation])).toBe(0)
  })
  it('binds citation to purchased version and passage', () => {
    for (const other of [{...citation,version:'2'}, {...citation,spanId:'s2'}, {...citation,resourceId:'free'}]) {
      expect(answersIt('gold', lead('Gold here.'), [other])).toBe(0)
    }
  })
  it('does not conflate federated and historical identities', () => {
    const source = {schemaVersion:1 as const,origin:'https://example.com',sellerKey:'k',profileId:'p',resourceId:'paid',version:'1'}
    expect(answersIt('gold', lead('Gold here.'), [{...citation,source}])).toBe(0)
    expect(answersIt('gold', [{text:'Gold here.',citations:[{...citation,source}]}], [{...citation,source}])).toBe(1)
  })
  it('scores missing or blank gold as zero without a wildcard match', () => {
    for (const gold of [undefined,'','  ']) expect(answersIt(gold, lead('Anything.'), [citation])).toBe(0)
    expect(answersIt('missing', lead('Something else.'), [citation])).toBe(0)
  })
})
it('histograms keep endpoints and negative groups separate', () => {
  const rows = [{group:'relevant',value:0},{group:'relevant',value:0.2},{group:'negative',value:1}] as ValueRow[]
  const hist = valueHistograms(rows)
  expect(hist.relevant.count).toBe(2)
  expect(hist.relevant.bins[4].count).toBe(1)
  expect(hist.negative.bins.at(-1)?.count).toBe(1)
  expect(valueHistograms([]).negative.max).toBeNull()
})
it('copies every decision row and recorded components, without rerunning a provider', async () => {
  const { decisionValues } = await import('../scripts/judge-bank-scorer.js')
  const { DecisionRoundSchema } = await import('../shared/contracts/index.js')
  const round = DecisionRoundSchema.parse({round:1,gap:'test',gapMaterial:0.8,provider:'fixture',model:'metadata-fixture',threshold:0.2,rows:[{
    candidate:{profileId:'p',resourceId:'article',version:'1',title:'Test',publisher:'Test writer',writerSlug:'writer',preview:'Public preview',price:{amountMinor:10,currency:'SGD'},family:'f',facets:[],authority:1,tier:'PAID',license:{kind:'test',attribution:'Test'},relevance:0.4},
    judgment:{addressesGap:0.3,originality:{original:0.9,rewrite:0.03,overlap:0.07},credibility:1},
    reputation:{H:1,C:0.8,T:0.8,status:'active'},value:0.123,valuePerDollar:1.23,verdict:'SKIP_LOW_VALUE',reason:'Recorded reason',
  }]})
  const rows = decisionValues('Q1',true,[round,{...round,round:2}])
  expect(rows).toHaveLength(2)
  expect(rows[0]).toMatchObject({questionId:'Q1',group:'negative',writer:'writer',article:'article',relevance:0.4,gapMaterial:0.8,trust:0.8,value:0.123,verdict:'SKIP_LOW_VALUE',reason:'Recorded reason',judgment:round.rows[0].judgment})
  expect(rows[1].round).toBe(2)
})
