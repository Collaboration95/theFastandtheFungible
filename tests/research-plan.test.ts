import { describe, expect, it } from 'vitest'
import {
  CANONICAL_RESEARCH_PLAN_DEFAULTS,
  createResearchPlan,
  isResearchPlanArtifact,
  parseResearchPlan,
  serializeResearchPlan,
} from '../src/research-plan'
import { QUESTION, type ResearchPlan } from '../src/domain'

describe('PLAN-01 finance research plan contract', () => {
  it('produces distinct evidence priorities for all three approaches', () => {
    const approaches = ['BALANCED_DILIGENCE', 'THESIS_STRESS_TEST', 'BUDGET_FIRST_SCAN'] as const
    const plans = approaches.map((approach) => createResearchPlan(approach))
    const signatures = plans.map((plan) => plan.evidencePriorities.map((priority) => `${priority.id}:${priority.label}`).join('|'))

    expect(new Set(signatures).size).toBe(3)
    expect(plans[0].evidencePriorities.map((priority) => priority.id)).toEqual(['balanced-support', 'balanced-challenge', 'balanced-independent'])
    expect(plans[1].evidencePriorities.map((priority) => priority.id)).toEqual(['stress-contradiction', 'stress-failure-mode', 'stress-corroboration'])
    expect(plans[2].evidencePriorities.map((priority) => priority.id)).toEqual(['budget-open-baseline', 'budget-material-gap', 'budget-marginal-value'])
    expect(plans[0].budgetIntent.strategy).not.toBe(plans[1].budgetIntent.strategy)
    expect(plans[1].budgetIntent.strategy).not.toBe(plans[2].budgetIntent.strategy)
  })

  it('creates a typed, versioned, JSON-serializable plan artifact', () => {
    const plan: ResearchPlan = createResearchPlan('THESIS_STRESS_TEST', {
      question: 'Will the investment thesis survive a grid-delay scenario?',
      decision: 'Capital allocation committee',
      horizon: '2028',
      budgetCents: 180,
      sourceAllowlist: ['public-data', 'financial-press'],
    })

    expect(plan.artifact).toBe('RESEARCH_PLAN')
    expect(plan.version).toBe(1)
    expect(plan.config.question).toContain('grid-delay')
    expect(plan.config.sourceAllowlist).toEqual(['public-data', 'financial-press'])
    expect(isResearchPlanArtifact(plan)).toBe(true)

    const serialized = serializeResearchPlan(plan)
    expect(parseResearchPlan(serialized)).toEqual(plan)
    expect(JSON.parse(serialized)).toEqual(plan)
  })

  it('makes every step observational or approval-seeking, never an access or payment authorization', () => {
    const plan = createResearchPlan()

    expect(plan.steps.length).toBeGreaterThan(0)
    expect(plan.steps.every((step) => step.guard.access === 'NO_ACCESS_GRANT')).toBe(true)
    expect(plan.steps.every((step) => step.guard.payment === 'NO_PAYMENT_AUTHORIZATION')).toBe(true)
    expect(plan.steps.some((step) => step.kind === 'REQUEST_MANUAL_APPROVAL')).toBe(true)
    expect(plan.executionBoundary.access).toBe('MANUAL_APPROVAL_REQUIRED')
    expect(plan.executionBoundary.payment).toBe('MANUAL_APPROVAL_REQUIRED')
    expect(plan.budgetIntent.premiumGate).toBe('MANUAL_APPROVAL_REQUIRED')
    expect(plan.budgetIntent.overBudget).toBe('BLOCK')
    expect(plan.steps.some((step) => (step as { kind: string }).kind === 'BUY')).toBe(false)
  })

  it('uses documented canonical defaults without copying article records or protected bodies', () => {
    const plan = createResearchPlan()
    const serialized = serializeResearchPlan(plan)

    expect(plan.config.question).toBe(QUESTION)
    expect(plan.config.budgetCents).toBe(CANONICAL_RESEARCH_PLAN_DEFAULTS.budgetCents)
    expect(plan.budgetIntent.perSourceCeilingCents).toBe(CANONICAL_RESEARCH_PLAN_DEFAULTS.perSourceCeilingCents)
    expect(plan.executionBoundary.sourcePolicy).toBe('CANONICAL_FIXTURE_CATALOG')
    expect(plan.executionBoundary.premiumBodies).toBe('SERVER_ONLY_UNTIL_PURCHASE')
    expect(serialized).not.toContain('Northstar Wire')
    expect(serialized).not.toContain('meridian-ledger')
    expect(serialized).not.toMatch(/"article"\s*:/)
    expect(serialized).not.toMatch(/"preview"\s*:/)
  })

  it('clones mutable input so a caller cannot mutate the canonical plan defaults', () => {
    const plan = createResearchPlan('BUDGET_FIRST_SCAN', { sourceTypes: ['public'] })
    plan.config.sourceTypes.push('mutated')
    plan.steps[0].evidencePriorityIds.push('mutated')

    const fresh = createResearchPlan('BUDGET_FIRST_SCAN')
    expect(fresh.config.sourceTypes).toEqual([...CANONICAL_RESEARCH_PLAN_DEFAULTS.sourceTypes])
    expect(fresh.steps[0].evidencePriorityIds).not.toContain('mutated')
  })

  it('rejects malformed plan artifacts instead of serializing values that cannot round-trip', () => {
    expect(() => createResearchPlan('BALANCED_DILIGENCE', { tokenLimit: Number.POSITIVE_INFINITY })).toThrow(/token limit must be finite/)

    const malformed = JSON.parse(serializeResearchPlan(createResearchPlan())) as ResearchPlan
    malformed.config.sourceAllowlist = ['public-data', 42 as unknown as string]
    expect(isResearchPlanArtifact(malformed)).toBe(false)
    expect(() => serializeResearchPlan(malformed)).toThrow(/invalid/)

    const inconsistentBudget = JSON.parse(serializeResearchPlan(createResearchPlan())) as ResearchPlan
    inconsistentBudget.budgetIntent.totalBudgetCents += 1
    expect(isResearchPlanArtifact(inconsistentBudget)).toBe(false)
    expect(() => parseResearchPlan(JSON.stringify(inconsistentBudget))).toThrow(/invalid or unsupported/)
  })
})
