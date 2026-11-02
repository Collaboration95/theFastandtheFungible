import { BUDGET } from '../shared/contracts/run.js'

/** Read once from the operator environment. Tool arguments never configure authority. */
export function budgetPolicy(env: NodeJS.ProcessEnv = process.env) {
  const read = (key: string) => {
    const value = env[key] ?? '0'
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`Invalid ${key}`)
    return Number(value)
  }
  return { maxMinor: Math.min(read('MCP_MAX_BUDGET_MINOR'), BUDGET.maxMinor), dailyMinor: read('MCP_DAILY_CAP_MINOR') }
}

export function clampBudget(requestedMinor: number, maxMinor: number, remainingMinor: number) {
  return Math.floor(Math.min(requestedMinor, maxMinor, remainingMinor, BUDGET.maxMinor) / BUDGET.stepMinor) * BUDGET.stepMinor
}
