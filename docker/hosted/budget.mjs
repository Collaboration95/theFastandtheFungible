// Billing budgets must be stated in the billing account's own currency.
// Defaults are about US$50 at November 2026 rates; other currencies need an explicit amount.
export const DEFAULT_BUDGETS = { USD: '50', SGD: '70' }

export function budgetAmount(currency, explicit) {
  if (!/^[A-Z]{3}$/.test(currency || '')) throw Error('Billing account currency is unavailable')
  if (explicit !== undefined) {
    const match = /^(\d{1,6}(?:\.\d{1,2})?)([A-Z]{3})$/.exec(explicit)
    if (!match || Number(match[1]) <= 0) throw Error('--budget-amount must look like 70SGD')
    if (match[2] !== currency) throw Error(`--budget-amount must use the billing account currency ${currency}`)
    return explicit
  }
  if (!DEFAULT_BUDGETS[currency]) throw Error(`No default budget for ${currency}; supply --budget-amount <amount>${currency}`)
  return DEFAULT_BUDGETS[currency] + currency
}

// An existing project is adopted only when it carries the labels this script
// would have created and is already linked to the selected billing account.
export function adoptable(project, billingInfo, billing) {
  return project?.lifecycleState === 'ACTIVE' && project.labels?.purpose === 'sff-demo' && project.labels?.expires === '20261120'
    && billingInfo?.billingEnabled === true && billingInfo.billingAccountName === `billingAccounts/${billing}`
}
