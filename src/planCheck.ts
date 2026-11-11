import type { Plan, RunSnapshot } from '../shared/contracts'

/**
 * "Ran the plan you confirmed": the plan card (PlanSheet) records what the visitor confirmed, and Show work compares it
 * with the PLAN event the run itself recorded. Read-only: no server call, nothing is sent anywhere.
 *
 * What is compared is the searches (the steps the card lists and lets you edit). The requested facts are derived again
 * by the server whenever the searches are edited, so they are not part of what was confirmed.
 */
export type ConfirmedPlan = { subqueries: string[]; at: number }
export type PlanCheck = { ok: true; text: string } | { ok: false; text: string }

const STORE = 'ra-confirmed-plans', KEEP = 8
/** A run is matched to the confirmation made just before it was created: not later than this, not earlier than that. */
const AFTER_MS = 10_000, BEFORE_MS = 60_000
let memory: ConfirmedPlan[] = []

const readStored = (): ConfirmedPlan[] => {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(STORE) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is ConfirmedPlan => Array.isArray(item?.subqueries) && item.subqueries.every((q: unknown) => typeof q === 'string') && Number.isFinite(item.at)) : []
  } catch { return [] }
}
const entries = () => { const seen = new Set<number>(); return [...readStored(), ...memory].filter(item => !seen.has(item.at) && seen.add(item.at)) }
/** Called when the visitor confirms (or the 5 s card starts on its own): the plan that is about to be sent. */
export function rememberConfirmedPlan(plan: Pick<Plan, 'subqueries'>, at = Date.now()) {
  memory = [...entries().filter(item => item.at !== at), { subqueries: [...plan.subqueries], at }].sort((a, b) => a.at - b.at).slice(-KEEP)
  try { sessionStorage.setItem(STORE, JSON.stringify(memory)) } catch { /* private mode: the check just stays hidden after a reload */ }
}
/** Tests and a fresh session start with nothing remembered. */
export function forgetConfirmedPlans() { memory = []; try { sessionStorage.removeItem(STORE) } catch { /* nothing stored */ } }

const timeOf = (run: Pick<RunSnapshot, 'events'>) => run.events.map(event => Date.parse(event.at)).filter(Number.isFinite).reduce((first, at) => Math.min(first, at), Infinity)
/** The confirmation made just before this run was created, if this browser made it. */
export function confirmedPlanFor(run: Pick<RunSnapshot, 'events'>): ConfirmedPlan | undefined {
  const created = timeOf(run)
  if (!Number.isFinite(created)) return undefined
  return entries().filter(item => item.at <= created + AFTER_MS && item.at >= created - BEFORE_MS).sort((a, b) => b.at - a.at)[0]
}

const normal = (query: string) => query.trim().replace(/\s+/g, ' ').toLowerCase()
const clip = (query: string) => { if (query.length <= 60) return query; const cut = query.slice(0, 59), space = cut.lastIndexOf(' '); return `${(space > 30 ? cut.slice(0, space) : cut).trimEnd()}…` }
const quoted = (queries: string[]) => queries.map(query => `“${clip(query)}”`).join(' and ')
/** The searches the run recorded in its PLAN event, or undefined for a snapshot from before it recorded one. */
export function ranSearches(run: Pick<RunSnapshot, 'events'>): string[] | undefined {
  const event = run.events.find(item => item.type === 'PLAN')
  const queries = (event?.data?.plan as { subqueries?: unknown } | undefined)?.subqueries
  return Array.isArray(queries) && queries.length && queries.every(query => typeof query === 'string') ? queries : undefined
}

/**
 * A match gives the ✓. A difference gives one plain sentence saying what changed and never the ✓. With no PLAN event
 * (an old snapshot) or no confirmation to compare, nothing is claimed and nothing is shown.
 */
export function planCheck(run: Pick<RunSnapshot, 'events'>, confirmed: Pick<ConfirmedPlan, 'subqueries'> | undefined = confirmedPlanFor(run)): PlanCheck | undefined {
  const ran = ranSearches(run)
  if (!ran || !confirmed?.subqueries.length) return undefined
  const asked = new Map(confirmed.subqueries.map(query => [normal(query), query])), did = new Map(ran.map(query => [normal(query), query]))
  const added = [...did].filter(([key]) => !asked.has(key)).map(([, query]) => query), removed = [...asked].filter(([key]) => !did.has(key)).map(([, query]) => query)
  if (!added.length && !removed.length) return { ok: true, text: 'Ran the plan you confirmed ✓' }
  // A clarifying answer is planned again on the server (the card showed the plan from before the answer): say so.
  const why = run.events.some(event => event.type === 'CLARIFY') ? ' Your answer to the clarifying question was used to plan again.' : ''
  if (added.length && removed.length) return { ok: false, text: `The run searched for ${quoted(added)} instead of ${quoted(removed)}, which you confirmed.${why}` }
  return { ok: false, text: `${added.length ? `The run added ${quoted(added)} to the searches you confirmed.` : `The run left out ${quoted(removed)} from the searches you confirmed.`}${why}` }
}
