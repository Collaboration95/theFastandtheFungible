export declare const DEFAULT_BUDGETS: Readonly<Record<string, string>>
export declare function budgetAmount(currency: string, explicit?: string): string
export declare function adoptable(
  project: { lifecycleState?: string; labels?: Record<string, string> } | undefined,
  billingInfo: { billingEnabled?: boolean; billingAccountName?: string } | undefined,
  billing: string,
): boolean
