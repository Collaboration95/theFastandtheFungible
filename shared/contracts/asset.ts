import { z } from 'zod'
export const RLUSD_CURRENCY = '524C555344000000000000000000000000000000'
export const RLUSD_TESTNET_ISSUER = 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV'
export const TEST_SGD_LABEL = 'TEST-SGD · IOU issued by our Testnet issuer · no real value · stand-in for RLUSD'
export const AssetSchema = z.union([z.object({currency:z.literal('SGT'), issuer:z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/), label:z.literal(TEST_SGD_LABEL)}), z.literal('XRP'), z.object({ currency: z.literal(RLUSD_CURRENCY), issuer: z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/), label: z.enum(['RLUSD (Testnet)', 'RLUSD Testnet', 'test USD (substitute for RLUSD)']) }).refine(a => a.issuer === RLUSD_TESTNET_ISSUER ? ['RLUSD (Testnet)', 'RLUSD Testnet'].includes(a.label) : a.label === 'test USD (substitute for RLUSD)', 'Asset label must identify substitute issuers')])
export type Asset = z.infer<typeof AssetSchema>
/** Existing SGD budget units; fixed DEMO 1 SGD = 1 test USD. No FX or dollar backing claim. */
export const amountFor = (minor: number, asset: Asset = 'XRP') => asset === 'XRP' ? String(minor * 1000) : (minor / 100).toFixed(2)
export const ledgerAmount = (value: string, asset: Asset = 'XRP') => asset === 'XRP' ? value : { currency: asset.currency, issuer: asset.issuer, value }
/** Exact decimal arithmetic; no float comparisons, exponent strings or unknown delivered amounts. */
export function decimalUnits(value: unknown): bigint | undefined {
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d{1,18})?$/.test(value)) return undefined
  const negative = value.startsWith('-'), [whole, fraction = ''] = value.replace(/^-/, '').split('.')
  const units = BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'))
  return negative ? -units : units
}
export function matchesAmount(actual: unknown, value: string, asset: Asset = 'XRP'): boolean {
  if (asset === 'XRP') return actual === value
  if (!actual || typeof actual !== 'object') return false
  const a = actual as Record<string, unknown>, units = decimalUnits(a.value)
  return a.currency === asset.currency && a.issuer === asset.issuer && units !== undefined && units === decimalUnits(value)
}
