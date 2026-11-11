import type { BrowserVerification } from './verify/browser'

/** Pure presentation policy: unreachable infrastructure is not a failed receipt check. */
export function verificationError(error: unknown, online: boolean): string {
  if (!online) return "You're offline: the checker couldn't load. Try again when you're back online."
  if (error instanceof Error && /Read-only Testnet lookup unavailable|Ledger (?:timeout|connection closed)/i.test(error.message)) return "Couldn't reach a public XRPL node. Try again in a moment."
  if (error instanceof Error && error.message === 'receipts') return 'This run’s receipts could not be downloaded.'
  if (error instanceof Error && /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(error.message)) return 'The checker couldn’t load. Try again in a moment.'
  return 'The checks could not finish in this browser.'
}
export function verificationNetworkFailure(result: BrowserVerification): Error | undefined {
  return result.checks.some(check => check.status === 'FAIL' && /^(testnet|audit anchor|anchor binding)/.test(check.check) && /(?:lookup unavailable|ledger timeout|ledger connection closed)/i.test(check.detail))
    ? new Error('Read-only Testnet lookup unavailable') : undefined
}
