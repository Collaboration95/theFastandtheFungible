// Deterministic authoring aid for the synthetic corpus. Never reads the eval bank.
// Only catalogue noun phrases leave the publisher; no private prose or values.
import type { FactCover } from './contracts/manifest.js'
import type { Article } from './contracts/writers.js'

const entities = [
  'Kestrel Semiconductor', 'Kestrel', 'Penang', 'Johor', 'TSMC', 'CoWoS', 'HBM',
  'Bank of Japan', 'BoJ', 'JGB', 'Federal Reserve', 'Fed', 'US Treasury',
  'Singapore', 'Malaysia', 'Thailand', 'Vietnam', 'Japan', 'China', 'India',
  'Europe', 'European', 'Asian', 'Asia', 'ASEAN', 'United States', 'US',
  'Energy Market Authority', 'EMA', 'data centres', 'data centers', 'OSAT',
  'life insurers', 'central banks', 'banks', 'investors', 'semiconductor',
  'grid', 'market', 'rooftop system', 'auction', 'insurers', 'JGBs', 'RBI', 'PBoC', 'MAS', 'ECB',
  'solar', 'farm', 'plant', 'contract', 'interconnectors', 'foundries', 'foundry', 'wafer', 'wafers',
  'chip', 'chips', 'startups', 'OSAT partners', 'QFN', 'BGA', 'RFQs', 'node', 'nodes', 'yield', 'yields',
  'DRAM', 'NAND', 'SGS', 'Mizuho', 'Nomura', 'Taipei', 'Malaysian', 'chipmaking', 'AI accelerator',
  'curve', 'bonds', 'analysts', 'substation', 'data centre', 'data center', 'Taiwan', 'Indonesia', 'suppliers',
]
const measures = [
  'duration', 'spread', 'gross margin', 'revenue', 'wafer price', 'wafer pricing', 'prepayment',
  'lead times', 'lead time', 'capacity slots', 'allocation', 'capacity',
  'policy rate', 'interest rate', 'yield curve', 'yield', 'yields', 'term premium',
  'reserve margin', 'reserve margins', 'price spread', 'water use', 'water',
  'power demand', 'electricity demand', 'electricity', 'power', 'solar',
  'interconnector', 'connection queue', 'connection queues', 'grid connection',
  'auction', 'bond', 'bonds', 'rates', 'rate', 'inflation', 'pricing', 'price',
  'cost', 'costs', 'demand', 'supply', 'inventory', 'production', 'shipments',
  'growth', 'investment', 'efficiency', 'profit', 'margin', 'margins', 'exports',
  'packaging', 'regulation', 'debt', 'risk', 'return', 'returns', 'output',
  'consumption', 'emissions', 'tariff', 'tariffs', 'recovery', 'report',
  'figure', 'forecast', 'market', 'source', 'statement', 'plan', 'plans', 'purchases', 'peak', 'average',
  'draw', 'generation', 'transmission', 'throughput', 'spreads', 'spread', 'shortage', 'shares', 'share',
  'inflows', 'holdings', 'instalments', 'installments', 'volume', 'quote', 'weeks', 'slots', 'lead', 'carbon', 'deals', 'flow',
]
const teamEntities = [...entities, 'EscrowFinish', 'EscrowCreate', 'XRPL', 'XRP', 'RLUSD', 'Testnet', 'writer', 'buyer', 'engine', 'policy', 'Credentials']
const teamMeasures = [...measures, 'fee', 'fees', 'drops', 'fulfillment', 'settlement', 'delivery', 'payment', 'key', 'identity', 'budget', 'funds']
const years: Record<string, string> = { '2023': 'twenty twenty three', '2024': 'twenty twenty four', '2025': 'twenty twenty five', '2026': 'twenty twenty six', '2027': 'twenty twenty seven', '2028': 'twenty twenty eight', '2029': 'twenty twenty nine', '2030': 'twenty thirty' }
export const menuText = (text: string) => text.toLowerCase().replace(/[’']s\b/g, '').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
export const mentionsMenuPhrase = (text: string, phrase: string) => ` ${menuText(text)} `.includes(` ${menuText(phrase)} `)

/** No values: entity/measure are vocabulary entries; the optional period is a spelled-out year. */
export function deriveFactMenu(article: Pick<Article, 'tier' | 'passages'> & Partial<Pick<Article, 'publisherSlug'>>): Record<string, FactCover> {
  if (article.tier !== 'PAID') return {}
  return Object.fromEntries(article.passages.flatMap(p => {
    const team = article.publisherSlug === 'team-builder-notes'
    const entity = (team ? teamEntities : entities).find(e => mentionsMenuPhrase(p.text, e))
    const measure = (team ? teamMeasures : measures).find(m => mentionsMenuPhrase(p.text, m))
    const year = p.text.match(/\b(?:fiscal|FY)\s*(20(?:2[3-9]|30))\b/i)?.[1] ?? p.text.match(/\b20(?:2[3-9]|30)\b/)?.[0]
    return entity && measure ? [[p.id, { entity, measure, ...(year ? { period: years[year] } : {}) }]] : []
  }))
}

/** Lexical promise check, not semantic truth or relevance. No other passage can rescue a broken binding. */
export function satisfiesFactCover(text: string, covers: FactCover): boolean {
  const periodText = Object.entries(years).reduce((s, [digits, words]) => s.replaceAll(digits, words), text)
  return mentionsMenuPhrase(text, covers.entity) && mentionsMenuPhrase(text, covers.measure)
    && (!covers.period || mentionsMenuPhrase(periodText, covers.period))
    && (!covers.comparison || mentionsMenuPhrase(text, covers.comparison))
}

/** Display only: keep value-free signed catalogue periods unchanged. */
export const displayPeriod = (period: string) => Object.entries(years).reduce((text, [digits, words]) => text.replaceAll(words, digits), period)
