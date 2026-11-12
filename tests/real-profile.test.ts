import { expect, it, vi } from 'vitest'
import { loadWriterCorpus, selectCorpusProfile } from '../publisher/corpus.js'
import { loadPublicDocs } from '../publisher/writers/public-docs.js'
import type { WriterCorpus } from '../shared/contracts/writers.js'
vi.mock('../publisher/writers/public-docs.js', async original => ({...await original<typeof import('../publisher/writers/public-docs.js')>(),loadPublicDocs:vi.fn()}))
it('preserves default fixtures and excludes every synthetic writer from real content',async()=>{
  const corpus=await loadWriterCorpus(undefined,{profile:'default'})
  const real=selectCorpusProfile(corpus,'real')
  expect(corpus.publishers.some(p=>p.slug==='alphaleak')).toBe(true)
  expect(real.publishers.map(p=>p.slug).sort()).toEqual(['team-builder-notes','team-xrpl-explainers'])
  const slugs=new Set(real.publishers.map(p=>p.slug))
  expect(real.publishers.every(p=>!p.synthetic)).toBe(true)
  expect(real.writers.every(w=>slugs.has(w.publisherSlug))).toBe(true)
  expect(real.articles.every(a=>slugs.has(a.publisherSlug))).toBe(true)
  // An author-supplied local writer survives; fictional local imports do not.
  const local={...corpus.publishers.find(p=>p.slug==='team-builder-notes')!,slug:'new-author',name:'New author'}
  expect(selectCorpusProfile({...corpus,publishers:[...corpus.publishers,local]},'real').publishers.some(p=>p.slug==='new-author')).toBe(true)
})
it('makes the real profile include documentation and the analytics writer without loading fictional free articles',async()=>{
  const base=await loadWriterCorpus(undefined,{profile:'default'})
  const article=structuredClone(base.articles.find(a=>a.publisherSlug==='team-builder-notes')!)
  article.articleId='docs-'+article.articleId;article.publisherSlug=article.writerSlug='xrpl-docs';article.tier='FREE';article.priceMinor=0
  const docs:WriterCorpus={publishers:[{...base.publishers.find(p=>p.slug==='team-builder-notes')!,slug:'xrpl-docs',kind:'records'}],writers:[{...base.writers.find(w=>w.publisherSlug==='team-builder-notes')!,slug:'xrpl-docs',publisherSlug:'xrpl-docs'}],articles:[article]}
  vi.mocked(loadPublicDocs).mockResolvedValue(docs)
  const real=await loadWriterCorpus(undefined,{profile:'real'})
  expect(real.publishers.map(p=>p.slug).sort()).toEqual(['ledger-analytics','team-builder-notes','team-xrpl-explainers','xrpl-docs'])
  expect(real.articles.filter(a=>a.tier==='FREE').every(a=>a.publisherSlug==='xrpl-docs')).toBe(true)
  expect(real.articles.some(a=>a.publisherSlug==='team-builder-notes'&&a.tier==='PAID')).toBe(true)
  // Match ConfigSchema's accepted casing/whitespace and empty default values.
  try {
    vi.stubEnv('CORPUS_PROFILE',' REAL ')
    expect((await loadWriterCorpus()).publishers.map(p=>p.slug)).toEqual(real.publishers.map(p=>p.slug))
    vi.stubEnv('CORPUS_PROFILE','');vi.stubEnv('FREE_TIER',' PUBLIC-DOCS ')
    const defaults=await loadWriterCorpus()
    expect(defaults.publishers.some(p=>p.slug==='alphaleak')).toBe(true)
    expect(defaults.publishers.some(p=>p.slug==='xrpl-docs')).toBe(true)
    expect(defaults.articles.filter(a=>a.tier==='FREE').every(a=>a.publisherSlug==='xrpl-docs')).toBe(true)
  } finally {vi.unstubAllEnvs()}
})
it('shows public-documentation and team-authored provenance on the writer badge',async()=>{
  const {createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{default:Badge}=await import('../src/components/WriterProvenance.js')
  expect(renderToStaticMarkup(createElement(Badge,{publisher:'XRPL documentation (XRPL Foundation and contributors)'}))).toContain('Public documentation')
  expect(renderToStaticMarkup(createElement(Badge,{publisher:'ResearchAgent ledger analytics (team-authored)'}))).toContain('Team-authored')
  const {EnvFacts}=await import('../src/components/EnvIndicator.js')
  expect(renderToStaticMarkup(createElement(EnvFacts,{realCorpus:true}))).not.toContain('fictional')
  expect(renderToStaticMarkup(createElement(EnvFacts,{}))).toContain('fictional')
})
