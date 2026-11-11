// The budget kill switch's only decision, kept free of dependencies so the repo's tests can load it.
/** True when actual spend has reached the budget. Forecasted spend is ignored on purpose. */
function overBudget(status) {
  const cost = Number(status?.costAmount), budget = Number(status?.budgetAmount)
  return Number.isFinite(cost) && Number.isFinite(budget) && budget > 0 && cost >= budget
}
module.exports = { overBudget }
