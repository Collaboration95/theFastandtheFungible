import { z } from 'zod'
export const LedgerAnchorSchema = z.object({
  version: z.literal('anchor-v1'), network: z.literal('xrpl:1'),
  txHash: z.string().regex(/^[A-F0-9]{64}$/), account: z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/),
  head: z.string().regex(/^[a-f0-9]{64}$/), runIdHash: z.string().regex(/^[a-f0-9]{64}$/),
  ledgerIndex: z.number().int().positive(), feeDrops: z.string().regex(/^[1-9][0-9]*$/),
})
export type LedgerAnchor = z.infer<typeof LedgerAnchorSchema>
