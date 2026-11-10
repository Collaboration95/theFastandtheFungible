import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { loadConfig } from './config.js'
import { isValidClassicAddress } from 'xrpl'
import { z } from 'zod'
const cap = z.number().int().min(0).max(100000)
export const OwnerSettings = z.object({ MCP_MAX_BUDGET_MINOR: cap.max(500), MCP_DAILY_CAP_MINOR: cap, WALLET_DAILY_CAP_MINOR: cap, SETTLEMENT_RAIL: z.enum(['simulated','xrpl-testnet']), ESCROW_MODE: z.enum(['key-reveal','payment']), ESCROW_ASSET: z.enum(['XRP','TEST-SGD','test-iou']).transform(v=>v === 'TEST-SGD' ? 'test-iou' : v), ANCHOR_RAIL: z.enum(['off','xrpl-testnet']) }).strict()
export function applyOwnerConfig(env: NodeJS.ProcessEnv) {
  const file = resolve(env.RA_DATA_DIR || dirname(env.APP_DB || 'data/app.db'), 'owner-settings.json')
  let raw: unknown
  try { raw = JSON.parse(readFileSync(file,'utf8')) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw Error('Owner settings unreadable',{cause:error}) }
  const parsed = OwnerSettings.partial().safeParse(raw)
  if (!parsed.success) throw Error('Owner settings invalid')
  validateOwnerSettings(parsed.data,env)
  for (const [k,v] of Object.entries(parsed.data)) env[k] = String(v)
}

export function validateOwnerSettings(settings: Partial<z.infer<typeof OwnerSettings>>, env: NodeJS.ProcessEnv) {
  const merged=loadConfig({...env,...Object.fromEntries(Object.entries(settings).map(([k,v])=>[k,String(v)]))})
  if (merged.ESCROW_ASSET === 'test-iou' && (merged.ESCROW_MODE !== 'key-reveal' || !merged.TESTNET_IOU_ISSUER || !isValidClassicAddress(merged.TESTNET_IOU_ISSUER))) throw Error('TEST-SGD requires key-reveal and a valid Testnet issuer')
}
