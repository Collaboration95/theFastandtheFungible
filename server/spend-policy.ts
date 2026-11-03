import { loadConfig } from './config.js'
import { BUDGET } from '../shared/contracts/run.js'
import type { Store } from './store.js'
import type { ModeLabels } from '../shared/contracts/run.js'

export const POLICY_VERSION = 'wallet-v1'
export type Surface = 'web' | 'mcp' | 'x402' | 'agent'
export const PAUSED = 'Spending paused by the operator; nothing was charged'
export function spendPolicy(env: NodeJS.ProcessEnv = loadConfig()) {
  const config = loadConfig(env)
  return { walletDailyMinor: Number(config.WALLET_DAILY_CAP_MINOR ?? '2000'),
    maxMinor: BUDGET.maxMinor, paused: config.SPENDING_PAUSED === '1' }
}
/** One authority seam. Future surfaces must supply operator caps, never model-supplied caps. */
export function admit(store: Store, input: { surface: Surface; principal: string; question: string;
  requestedMinor: number; idempotencyKey: string; maxMinor: number; dailyMinor?: number; labels?: ModeLabels; reserveMinor?: number }) {
  return store.admit(input)
}
