import { z } from 'zod'

export const LEDGER_REPORT_TOPICS = ['rlusd', 'amm', 'project-activity'] as const
export type LedgerReportTopic = typeof LEDGER_REPORT_TOPICS[number]
/** Refresh starts are periodic; K also covers computation and a ledger-speed margin. */
export const LEDGER_REPORT_POLICY = {
  rlusd: { refreshMs: 600_000, maxLedgerLag: 256, network: 'mainnet' },
  amm: { refreshMs: 120_000, maxLedgerLag: 64, network: 'mainnet' },
  'project-activity': { refreshMs: 120_000, maxLedgerLag: 64, network: 'testnet' },
} as const
export const LedgerFreshnessSchema = z.object({
  topic: z.enum(LEDGER_REPORT_TOPICS), network: z.enum(['mainnet', 'testnet']),
  ledgerIndex: z.number().int().positive(), ledgerHash: z.string().regex(/^[A-F0-9]{64}$/),
  computedAt: z.string().datetime(), maxLedgerLag: z.number().int().min(1).max(512),
}).strict()
export type LedgerFreshness = z.infer<typeof LedgerFreshnessSchema>
const stampPattern = /As of validated ledger (\d+) \(hash ([A-F0-9]{64})\), computed at ([\dTZ:.+-]+)\. Network: (mainnet|testnet)\. The writer promises this report is no more than (\d+) validated ledgers old at purchase\./
/** Also reads retained historical evidence whose manifests predate explicit metadata. */
export function reportStamp(body: string) {
  const m = stampPattern.exec(body)
  if (!m) throw Error('Missing signed ledger freshness promise')
  const stamp = { ledgerIndex: Number(m[1]), ledgerHash: m[2], computedAt: m[3], network: m[4] as 'mainnet' | 'testnet', maxLedgerLag: Number(m[5]) }
  if (!Number.isSafeInteger(stamp.ledgerIndex) || stamp.ledgerIndex < 1 || !Number.isInteger(stamp.maxLedgerLag) || stamp.maxLedgerLag < 1 || stamp.maxLedgerLag > 512 || !Number.isFinite(Date.parse(stamp.computedAt))) throw Error('Invalid signed freshness bounds')
  return stamp
}
export function reportTopic(article: { family: string }): LedgerReportTopic | undefined {
  return LEDGER_REPORT_TOPICS.find(topic => article.family === `ledger-${topic}`)
}
export function ledgerFreshness(article: { family: string; body: string }): LedgerFreshness | undefined {
  const topic = reportTopic(article)
  return topic ? LedgerFreshnessSchema.parse({ topic, ...reportStamp(article.body) }) : undefined
}
