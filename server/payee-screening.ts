import { existsSync, readFileSync } from 'node:fs'
import { z } from 'zod'

const Denylist = z.array(z.object({ address: z.string().min(1), reason: z.string().min(1) }))
/** Operator denylist hook (#288), not a sanctions screening provider. Invalid config fails closed. */
export function payeeRefusal(address: string, file = process.env.PAYEE_DENYLIST_FILE || 'data/payee-denylist.json'): string | undefined {
  if (!existsSync(file)) return undefined
  try {
    const list = Denylist.parse(JSON.parse(readFileSync(file, 'utf8')))
    return list.some(item => item.address === address) ? 'Payee is on the operator denylist; nothing was charged' : undefined
  } catch { return 'Operator payee denylist is invalid; nothing was charged' }
}
