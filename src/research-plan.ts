import {
  DEFAULT_BUDGET_CENTS,
  MAX_BUDGET_CENTS,
  MIN_BUDGET_CENTS,
  QUESTION,
  type ResearchApproach,
  type ResearchEvidencePriority,
  type ResearchPlan,
  type ResearchPlanArtifact,
  type ResearchPlanConfig,
  type ResearchPlanStep,
  type ResearchPlanStepKind,
  type ResearchPlanStopCondition,
} from './domain'

/**
 * PLAN-01 contract.
 *
 * The defaults deliberately name the canonical fixture policy rather than
 * embedding article records. Article metadata and protected bodies remain in
 * the server-owned JSON catalog. A plan is a reviewable, serializable
 * proposal; it is never a payment command or an access grant.
 */
export const CANONICAL_RESEARCH_PLAN_DEFAULTS = {
  question: QUESTION,
  decision: 'What decision will this research support?',
  horizon: 'Through 2028',
  tokenLimit: 64_000,
  budgetCents: DEFAULT_BUDGET_CENTS,
  perSourceCeilingCents: 100,
  sourceTypes: ['primary', 'public', 'independent', 'specialist'],
  sourcePolicy: 'CANONICAL_FIXTURE_CATALOG',
  premiumBodies: 'SERVER_ONLY_UNTIL_PURCHASE',
  manualApproval: 'REQUIRED_BEFORE_EACH_PREMIUM_PURCHASE',
} as const

export const RESEARCH_PLAN_VERSION = 1 as const

const MIN_TOKEN_LIMIT = 8_000
const MAX_TOKEN_LIMIT = 256_000
const APPROACHES: readonly ResearchApproach[] = ['BALANCED_DILIGENCE', 'THESIS_STRESS_TEST', 'BUDGET_FIRST_SCAN']
const STEP_KINDS: readonly ResearchPlanStepKind[] = ['FRAME_QUESTION', 'READ_OPEN_EVIDENCE', 'MAP_EVIDENCE_FAMILIES', 'IDENTIFY_GAP', 'COMPARE_PREMIUM_METADATA', 'REQUEST_MANUAL_APPROVAL', 'RECORD_EVIDENCE_IMPACT', 'SYNTHESIZE_CITED_DOSSIER']
const STOP_OUTCOMES: readonly ResearchPlanStopCondition['outcome'][] = ['STOP_AND_REPORT', 'STOP_BEFORE_PREMIUM_REVIEW', 'CONTINUE_WITH_UNCERTAINTY']
const BUDGET_STRATEGIES: readonly ResearchPlanArtifact['budgetIntent']['strategy'][] = ['BALANCE_EVIDENCE', 'CHALLENGE_THESIS', 'OPEN_BASELINE_FIRST']

type ApproachBlueprint = {
  evidencePriorities: ResearchEvidencePriority[];
  stepKinds: ResearchPlanStepKind[];
  stepTitles: string[];
  stepObjectives: string[];
  stopConditions: ResearchPlanStopCondition[];
  budgetStrategy: ResearchPlanArtifact['budgetIntent']['strategy'];
}

const NO_AUTHORIZATION = {
  access: 'NO_ACCESS_GRANT',
  payment: 'NO_PAYMENT_AUTHORIZATION',
} as const

const APPROACH_BLUEPRINTS: Record<ResearchApproach, ApproachBlueprint> = {
  BALANCED_DILIGENCE: {
    evidencePriorities: [
      {
        id: 'balanced-support',
        label: 'Support for the working thesis',
        rationale: 'Establish what the available evidence actually supports before expanding the claim.',
        signals: ['primary statements', 'observable demand or operating data'],
        minimumIndependentFamilies: 1,
      },
      {
        id: 'balanced-challenge',
        label: 'Challenges and constraints',
        rationale: 'Look for material evidence that narrows, qualifies, or contradicts the working thesis.',
        signals: ['delivery constraints', 'counter-evidence', 'uncertainty'],
        minimumIndependentFamilies: 1,
      },
      {
        id: 'balanced-independent',
        label: 'Independent corroboration',
        rationale: 'Prefer evidence from a separate family so repeated issuer language is not counted twice.',
        signals: ['independent reporting', 'separate source family'],
        minimumIndependentFamilies: 2,
      },
    ],
    stepKinds: [
      'FRAME_QUESTION',
      'READ_OPEN_EVIDENCE',
      'MAP_EVIDENCE_FAMILIES',
      'IDENTIFY_GAP',
      'COMPARE_PREMIUM_METADATA',
      'REQUEST_MANUAL_APPROVAL',
      'RECORD_EVIDENCE_IMPACT',
      'SYNTHESIZE_CITED_DOSSIER',
    ],
    stepTitles: [
      'Frame the decision and working thesis',
      'Read the open baseline',
      'Separate evidence families',
      'State the unresolved evidence gap',
      'Compare candidate evidence metadata',
      'Request explicit approval for any premium source',
      'Record the verified evidence impact',
      'Synthesize a cited dossier',
    ],
    stepObjectives: [
      'Turn the question into a bounded decision and a testable working thesis.',
      'Collect open previews and citations before considering locked evidence.',
      'Distinguish independent corroboration from derivative repetition.',
      'Name what remains unknown and why it matters to the decision.',
      'Compare gap fit, novelty, authority, price, and family independence.',
      'Present the exact quote and wait for the analyst; this step cannot grant access or authorize payment.',
      'Only after the server verifies the approved lifecycle, link newly accessible spans to changed claims.',
      'Report support, challenges, uncertainty, citations, licensing, and runtime labels.',
    ],
    stopConditions: [
      { id: 'balanced-no-open-baseline', label: 'No usable open baseline', condition: 'Required open evidence cannot be identified in the approved fixture catalog.', outcome: 'STOP_AND_REPORT' },
      { id: 'balanced-gap-closed', label: 'Material gap is closed', condition: 'The decision-relevant gap is supported by independent evidence families.', outcome: 'CONTINUE_WITH_UNCERTAINTY' },
      { id: 'balanced-approval-needed', label: 'Premium evidence is proposed', condition: 'A locked source could help, but no access or payment is allowed until manual approval.', outcome: 'STOP_BEFORE_PREMIUM_REVIEW' },
    ],
    budgetStrategy: 'BALANCE_EVIDENCE',
  },
  THESIS_STRESS_TEST: {
    evidencePriorities: [
      {
        id: 'stress-contradiction',
        label: 'Contradictory evidence first',
        rationale: 'Search for credible evidence that would falsify or materially weaken the working thesis.',
        signals: ['negative indicators', 'missed milestones', 'counterexamples'],
        minimumIndependentFamilies: 1,
      },
      {
        id: 'stress-failure-mode',
        label: 'Decision-relevant failure modes',
        rationale: 'Prioritize constraints that could change the recommendation within the decision horizon.',
        signals: ['operational bottlenecks', 'delivery timing', 'scenario downside'],
        minimumIndependentFamilies: 2,
      },
      {
        id: 'stress-corroboration',
        label: 'Corroborate survivors',
        rationale: 'Only after a challenge survives review, seek independent evidence that bounds its severity.',
        signals: ['independent validation', 'scope and uncertainty'],
        minimumIndependentFamilies: 2,
      },
    ],
    stepKinds: [
      'FRAME_QUESTION',
      'READ_OPEN_EVIDENCE',
      'IDENTIFY_GAP',
      'MAP_EVIDENCE_FAMILIES',
      'COMPARE_PREMIUM_METADATA',
      'REQUEST_MANUAL_APPROVAL',
      'RECORD_EVIDENCE_IMPACT',
      'SYNTHESIZE_CITED_DOSSIER',
    ],
    stepTitles: [
      'Frame the thesis and falsification test',
      'Read open evidence for disconfirming signals',
      'Name the highest-consequence failure mode',
      'Check whether the challenge is independently grounded',
      'Compare the strongest challenge candidates',
      'Request explicit approval for any premium challenge evidence',
      'Record whether the thesis changed after verified evidence',
      'Synthesize a cited stress-test dossier',
    ],
    stepObjectives: [
      'Define what would materially weaken the thesis before reviewing sources.',
      'Start with open evidence that could disconfirm the thesis; do not infer facts from a model.',
      'Prioritize a failure mode that could alter the decision within the stated horizon.',
      'Track source-family independence and avoid counting derivative repeats as corroboration.',
      'Compare challenge fit, novelty, authority, price, and licensing metadata.',
      'Show the quote and wait for the analyst; this step cannot grant access or authorize payment.',
      'Link any revised claim only to spans made accessible by the verified server lifecycle.',
      'Preserve what remained uncertain and cite every material challenge.',
    ],
    stopConditions: [
      { id: 'stress-no-challenge', label: 'No credible challenge found', condition: 'The approved fixture metadata contains no decision-relevant counter-signal.', outcome: 'STOP_AND_REPORT' },
      { id: 'stress-failure-bounded', label: 'Failure mode is bounded', condition: 'The leading challenge is independently corroborated or explicitly marked unresolved.', outcome: 'CONTINUE_WITH_UNCERTAINTY' },
      { id: 'stress-approval-needed', label: 'Premium challenge is proposed', condition: 'A locked source could test the failure mode, but access and payment remain manual decisions.', outcome: 'STOP_BEFORE_PREMIUM_REVIEW' },
    ],
    budgetStrategy: 'CHALLENGE_THESIS',
  },
  BUDGET_FIRST_SCAN: {
    evidencePriorities: [
      {
        id: 'budget-open-baseline',
        label: 'Open-source baseline',
        rationale: 'Establish the strongest answer available without spending from the mandate.',
        signals: ['open previews', 'primary data', 'known limitations'],
        minimumIndependentFamilies: 1,
      },
      {
        id: 'budget-material-gap',
        label: 'Material gap before spend',
        rationale: 'Only elevate a premium candidate when the open baseline leaves a decision-relevant gap.',
        signals: ['unresolved gap', 'decision impact', 'independent family need'],
        minimumIndependentFamilies: 2,
      },
      {
        id: 'budget-marginal-value',
        label: 'Marginal value per budget unit',
        rationale: 'Compare cost, gap fit, authority, novelty, and remaining budget without treating price as quality.',
        signals: ['integer quote', 'remaining budget', 'expected evidence impact'],
        minimumIndependentFamilies: 1,
      },
    ],
    stepKinds: [
      'FRAME_QUESTION',
      'READ_OPEN_EVIDENCE',
      'MAP_EVIDENCE_FAMILIES',
      'IDENTIFY_GAP',
      'COMPARE_PREMIUM_METADATA',
      'REQUEST_MANUAL_APPROVAL',
      'RECORD_EVIDENCE_IMPACT',
      'SYNTHESIZE_CITED_DOSSIER',
    ],
    stepTitles: [
      'Frame the question and spending boundary',
      'Build the no-spend open baseline',
      'Cluster the baseline into evidence families',
      'Confirm a material gap remains',
      'Compare marginal evidence value within the budget',
      'Request explicit approval for a quoted premium source',
      'Record verified impact and remaining budget',
      'Synthesize a cited, budget-aware dossier',
    ],
    stepObjectives: [
      'Capture the decision, horizon, total budget, and per-source ceiling.',
      'Use open metadata and previews first; do not spend or unlock anything in planning.',
      'Avoid paying for derivative coverage that adds no independent family.',
      'Stop if open evidence is sufficient or if no material gap can be articulated.',
      'Rank candidates by evidence impact and integer budget checks, not unexplained composite scores.',
      'Display the exact quote and wait for the analyst; this step cannot grant access or authorize payment.',
      'Only verified server settlement and access can change evidence availability or spend.',
      'Keep the budget arithmetic, citations, fixture labels, and uncertainty visible.',
    ],
    stopConditions: [
      { id: 'budget-open-sufficient', label: 'Open baseline is sufficient', condition: 'No premium source is needed to answer the bounded decision with stated uncertainty.', outcome: 'CONTINUE_WITH_UNCERTAINTY' },
      { id: 'budget-no-affordable-candidate', label: 'No affordable candidate', condition: 'Every relevant premium candidate exceeds remaining budget or the per-source ceiling.', outcome: 'STOP_AND_REPORT' },
      { id: 'budget-approval-needed', label: 'Premium evidence is proposed', condition: 'A candidate fits the integer budget, but access and payment still require manual approval.', outcome: 'STOP_BEFORE_PREMIUM_REVIEW' },
    ],
    budgetStrategy: 'OPEN_BASELINE_FIRST',
  },
}

export type ResearchPlanInput = Partial<ResearchPlanConfig>

function normalizeBudget(value: number | undefined): number {
  const budget = value ?? CANONICAL_RESEARCH_PLAN_DEFAULTS.budgetCents
  if (!Number.isFinite(budget)) throw new RangeError('Research plan budget must be finite')
  return Math.max(MIN_BUDGET_CENTS, Math.min(MAX_BUDGET_CENTS, Math.round(budget)))
}

function normalizeTokenLimit(value: number | undefined): number {
  const tokenLimit = value ?? CANONICAL_RESEARCH_PLAN_DEFAULTS.tokenLimit
  if (!Number.isFinite(tokenLimit)) throw new RangeError('Research plan token limit must be finite')
  return Math.max(MIN_TOKEN_LIMIT, Math.min(MAX_TOKEN_LIMIT, Math.round(tokenLimit)))
}

function clonePriority(priority: ResearchEvidencePriority): ResearchEvidencePriority {
  return { ...priority, signals: [...priority.signals] }
}

function cloneStopCondition(condition: ResearchPlanStopCondition): ResearchPlanStopCondition {
  return { ...condition }
}

function defaultConfig(input: ResearchPlanInput): ResearchPlanConfig {
  const sourceTypes = input.sourceTypes?.length ? [...input.sourceTypes] : [...CANONICAL_RESEARCH_PLAN_DEFAULTS.sourceTypes]
  const sourceAllowlist = input.sourceAllowlist?.length ? [...input.sourceAllowlist] : undefined
  return {
    question: input.question?.trim() || CANONICAL_RESEARCH_PLAN_DEFAULTS.question,
    decision: input.decision?.trim() || CANONICAL_RESEARCH_PLAN_DEFAULTS.decision,
    horizon: input.horizon?.trim() || CANONICAL_RESEARCH_PLAN_DEFAULTS.horizon,
    tokenLimit: normalizeTokenLimit(input.tokenLimit),
    budgetCents: normalizeBudget(input.budgetCents),
    sourceTypes,
    ...(sourceAllowlist ? { sourceAllowlist } : {}),
  }
}

function buildSteps(blueprint: ApproachBlueprint): ResearchPlanStep[] {
  return blueprint.stepKinds.map((kind, index) => ({
    id: `step-${String(index + 1).padStart(2, '0')}`,
    order: index + 1,
    kind,
    title: blueprint.stepTitles[index],
    objective: blueprint.stepObjectives[index],
    evidencePriorityIds: blueprint.evidencePriorities.map((priority) => priority.id),
    guard: { ...NO_AUTHORIZATION },
  }))
}

/**
 * Build a deterministic plan from explicit analyst inputs. The returned
 * object contains only JSON values and references the fixture policy by name;
 * it does not copy catalog records, authorize a purchase, or grant access.
 */
export function createResearchPlan(approach: ResearchApproach = 'BALANCED_DILIGENCE', input: ResearchPlanInput = {}): ResearchPlan {
  const blueprint = APPROACH_BLUEPRINTS[approach]
  if (!blueprint) throw new Error(`Unsupported research approach: ${String(approach)}`)
  const config = defaultConfig(input)
  return {
    artifact: 'RESEARCH_PLAN',
    version: RESEARCH_PLAN_VERSION,
    approach,
    config,
    evidencePriorities: blueprint.evidencePriorities.map(clonePriority),
    steps: buildSteps(blueprint),
    stopConditions: blueprint.stopConditions.map(cloneStopCondition),
    budgetIntent: {
      totalBudgetCents: config.budgetCents,
      perSourceCeilingCents: CANONICAL_RESEARCH_PLAN_DEFAULTS.perSourceCeilingCents,
      strategy: blueprint.budgetStrategy,
      premiumGate: 'MANUAL_APPROVAL_REQUIRED',
      overBudget: 'BLOCK',
    },
    executionBoundary: {
      sourcePolicy: 'CANONICAL_FIXTURE_CATALOG',
      premiumBodies: 'SERVER_ONLY_UNTIL_PURCHASE',
      access: 'MANUAL_APPROVAL_REQUIRED',
      payment: 'MANUAL_APPROVAL_REQUIRED',
      runtimeLabels: ['FIXTURE RESEARCH', 'XRPL TESTNET RESEARCH'],
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isUniqueStrings(values: string[]): boolean {
  return new Set(values).size === values.length
}

function isValidConfig(value: unknown): value is ResearchPlanConfig {
  return isRecord(value)
    && typeof value.question === 'string'
    && typeof value.decision === 'string'
    && typeof value.horizon === 'string'
    && typeof value.tokenLimit === 'number'
    && Number.isFinite(value.tokenLimit)
    && Number.isInteger(value.tokenLimit)
    && value.tokenLimit >= MIN_TOKEN_LIMIT
    && value.tokenLimit <= MAX_TOKEN_LIMIT
    && typeof value.budgetCents === 'number'
    && Number.isFinite(value.budgetCents)
    && Number.isInteger(value.budgetCents)
    && value.budgetCents >= MIN_BUDGET_CENTS
    && value.budgetCents <= MAX_BUDGET_CENTS
    && isStringList(value.sourceTypes)
    && value.sourceTypes.length > 0
    && (value.sourceAllowlist === undefined || isStringList(value.sourceAllowlist))
}

/** A narrow runtime check for persisted or transportable plan artifacts. */
export function isResearchPlanArtifact(value: unknown): value is ResearchPlanArtifact {
  if (!isRecord(value)) return false
  if (value.artifact !== 'RESEARCH_PLAN' || value.version !== RESEARCH_PLAN_VERSION) return false
  if (!APPROACHES.includes(value.approach as ResearchApproach) || !isValidConfig(value.config)) return false
  if (!Array.isArray(value.evidencePriorities) || !value.evidencePriorities.length || !value.evidencePriorities.every((item) => isRecord(item) && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.rationale === 'string' && isStringList(item.signals) && typeof item.minimumIndependentFamilies === 'number' && Number.isInteger(item.minimumIndependentFamilies) && item.minimumIndependentFamilies > 0)) return false
  const priorityIds = value.evidencePriorities.map((item) => item.id)
  if (!isUniqueStrings(priorityIds)) return false
  if (!Array.isArray(value.steps) || !value.steps.length || !value.steps.every((item, index) => isRecord(item) && typeof item.id === 'string' && item.order === index + 1 && STEP_KINDS.includes(item.kind as ResearchPlanStepKind) && typeof item.title === 'string' && typeof item.objective === 'string' && isStringList(item.evidencePriorityIds) && item.evidencePriorityIds.length > 0 && item.evidencePriorityIds.every((id) => priorityIds.includes(id)) && isRecord(item.guard) && item.guard.access === 'NO_ACCESS_GRANT' && item.guard.payment === 'NO_PAYMENT_AUTHORIZATION')) return false
  if (!Array.isArray(value.stopConditions) || !value.stopConditions.length || !value.stopConditions.every((item) => isRecord(item) && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.condition === 'string' && STOP_OUTCOMES.includes(item.outcome as ResearchPlanStopCondition['outcome']))) return false
  if (!isRecord(value.budgetIntent) || value.budgetIntent.totalBudgetCents !== value.config.budgetCents || typeof value.budgetIntent.perSourceCeilingCents !== 'number' || !Number.isFinite(value.budgetIntent.perSourceCeilingCents) || !Number.isInteger(value.budgetIntent.perSourceCeilingCents) || value.budgetIntent.perSourceCeilingCents < 0 || !BUDGET_STRATEGIES.includes(value.budgetIntent.strategy as ResearchPlanArtifact['budgetIntent']['strategy']) || value.budgetIntent.premiumGate !== 'MANUAL_APPROVAL_REQUIRED' || value.budgetIntent.overBudget !== 'BLOCK') return false
  if (!isRecord(value.executionBoundary) || value.executionBoundary.sourcePolicy !== 'CANONICAL_FIXTURE_CATALOG' || value.executionBoundary.premiumBodies !== 'SERVER_ONLY_UNTIL_PURCHASE' || value.executionBoundary.access !== 'MANUAL_APPROVAL_REQUIRED' || value.executionBoundary.payment !== 'MANUAL_APPROVAL_REQUIRED' || !Array.isArray(value.executionBoundary.runtimeLabels) || value.executionBoundary.runtimeLabels.length !== 2 || value.executionBoundary.runtimeLabels[0] !== 'FIXTURE RESEARCH' || value.executionBoundary.runtimeLabels[1] !== 'XRPL TESTNET RESEARCH') return false
  return true
}

export function serializeResearchPlan(plan: ResearchPlan): string {
  if (!isResearchPlanArtifact(plan)) throw new TypeError('Cannot serialize an invalid research plan artifact')
  return JSON.stringify(plan)
}

export function parseResearchPlan(serialized: string): ResearchPlan {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch (error) {
    throw new TypeError(`Research plan JSON is invalid: ${(error as Error).message}`)
  }
  if (!isResearchPlanArtifact(parsed)) throw new TypeError('Research plan artifact is invalid or unsupported')
  return parsed
}
