import { loadConfig } from '../server/config.js'
import { BUDGET } from '../shared/contracts/run.js'

/** Read once from the operator environment. Tool arguments never configure authority. */
export function budgetPolicy(env: NodeJS.ProcessEnv = loadConfig()) {
  const config = loadConfig(env)
  return { maxMinor: Math.min(Number(config.MCP_MAX_BUDGET_MINOR ?? '0'), BUDGET.maxMinor), dailyMinor: Number(config.MCP_DAILY_CAP_MINOR ?? '0') }
}

export function clampBudget(requestedMinor: number, maxMinor: number, remainingMinor: number) {
  return Math.floor(Math.min(requestedMinor, maxMinor, remainingMinor, BUDGET.maxMinor) / BUDGET.stepMinor) * BUDGET.stepMinor
}
