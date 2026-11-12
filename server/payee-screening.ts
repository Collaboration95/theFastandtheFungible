import { createHash } from 'node:crypto'
import { isValidClassicAddress } from 'xrpl'
import ofacSnapshot from '../publisher/publishing/ofac-xrp.js'
import { existsSync, readFileSync } from 'node:fs'
import { z } from 'zod'

const Denylist = z.array(z.object({ address: z.string().trim().min(1), reason: z.string().trim().min(1) }))
export const DENYLIST_REFUSAL = 'Payee is on the operator denylist; nothing was charged'
export const DENYLIST_INVALID = 'Operator payee denylist is invalid; nothing was charged'
export type PayeeScreen = { refusal: string; address: string; reason?: string; list: 'operator-denylist' | 'ofac-sdn-xrp' }

/**
 * Policy screens exact operator-listed addresses before signing. Regulated mode also adds the pinned
 * OFAC XRP address snapshot. A missing operator file means no operator list is configured; malformed
 * configured lists fail closed. Absence from either dated address list is not a general payee clearance.
 */
export function screenPayee(address: string, file = process.env.PAYEE_DENYLIST_FILE || 'data/payee-denylist.json'): PayeeScreen | undefined {
  if (process.env.REGULATED_MODE === 'on') { const sanctions=screenSanctions(address); if(sanctions)return sanctions }
  if (!existsSync(file)) return undefined
  try {
    const entry = Denylist.parse(JSON.parse(readFileSync(file, 'utf8'))).find(item => item.address === address.trim())
    return entry ? { refusal: DENYLIST_REFUSAL, address: entry.address, reason: entry.reason, list: 'operator-denylist' } : undefined
  } catch { return { refusal: DENYLIST_INVALID, address, list: 'operator-denylist' } }
}
export function payeeRefusal(address: string, file?: string): string | undefined { return screenPayee(address, file)?.refusal }

export const OFAC_SNAPSHOT_SHA256 = 'e2e2255c312ac2c49eb38f6eb9fbf36923147cb8cc9a776c630fc4c2849c272b'
const Ofac = z.object({ source:z.literal('https://sanctionslistservice.ofac.treas.gov/api/download/sdn.xml'), sourceSha256:z.literal('329a9b9c6e554518639e979c28c6867d00b72b4175352dd8869766092bb3ed0c'), listDate:z.string().min(1), addresses:z.array(z.string().refine(isValidClassicAddress)).min(1).max(10000) }).strict()
/** Imported, authenticated build artifact only: no network calls in the money path. */
export function screenSanctions(address:string,snapshot:unknown=ofacSnapshot):PayeeScreen|undefined {
  try {
    const list=Ofac.parse(snapshot)
    if(createHash('sha256').update(JSON.stringify(list)).digest('hex')!==OFAC_SNAPSHOT_SHA256)throw Error('Snapshot integrity')
    return list.addresses.includes(address.trim()) ? {refusal:'Payee is on the OFAC XRP address list; nothing was charged',address,list:'ofac-sdn-xrp'} : undefined
  } catch {return {refusal:'OFAC XRP address list is invalid; nothing was charged',address,list:'ofac-sdn-xrp'}}
}
