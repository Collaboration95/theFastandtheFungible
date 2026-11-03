import { existsSync, readFileSync } from 'node:fs'
import { z } from 'zod'

const Denylist = z.array(z.object({ address: z.string().trim().min(1), reason: z.string().trim().min(1) }))
export const DENYLIST_REFUSAL = 'Payee is on the operator denylist; nothing was charged'
export const DENYLIST_INVALID = 'Operator payee denylist is invalid; nothing was charged'
export type PayeeScreen = { refusal: string; address: string; reason?: string; list: 'operator-denylist' }

/**
 * Operator denylist hook (#288): policy code calls this before any payment is signed. It is the integration
 * point for a sanctions or risk screen, NOT a sanctions-screening provider: it only matches the exact XRPL
 * addresses the operator listed. Missing file = no list configured. An unreadable or malformed file fails
 * closed, because a broken screen must not silently approve payments.
 */
export function screenPayee(address: string, file = process.env.PAYEE_DENYLIST_FILE || 'data/payee-denylist.json'): PayeeScreen | undefined {
  if (!existsSync(file)) return undefined
  try {
    const entry = Denylist.parse(JSON.parse(readFileSync(file, 'utf8'))).find(item => item.address === address.trim())
    return entry ? { refusal: DENYLIST_REFUSAL, address: entry.address, reason: entry.reason, list: 'operator-denylist' } : undefined
  } catch { return { refusal: DENYLIST_INVALID, address, list: 'operator-denylist' } }
}
export function payeeRefusal(address: string, file?: string): string | undefined { return screenPayee(address, file)?.refusal }
