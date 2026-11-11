// The requested-facts checklist (#208, #209), shared by the answer card and the report so both say the same thing.
import { RunCheckpointSchema, STOP_LABELS, type CoverageStatus, type RunSnapshot, type StopReason } from './contracts/index.js'

/** Reader-facing status words: no code vocabulary. */
export const FACT_STATUS: Record<CoverageStatus, string> = { supported: 'Answered', partial: 'Partly answered', missing: 'Not found', conflicting: 'Sources disagree', unknown: "Couldn't check" }
export type FactsSummary = { answered: number; total: number; facts: { id: string; text: string; status: CoverageStatus }[]; foundFree: boolean; stopReason?: StopReason; line: string; judge?: string; error?: string }

/** The checklist for one answer version (the latest by default); undefined for runs without requested facts. */
export function factsSummary(run: Pick<RunSnapshot, 'checkpoint' | 'answers' | 'spentMinor' | 'decisions'> & { question?: string }, version = run.answers.reduce((max, a) => Math.max(max, a.version), 0)): FactsSummary | undefined {
  const checkpoint = RunCheckpointSchema.safeParse(run.checkpoint)
  if (!checkpoint.success || !checkpoint.data.requirements?.length) return undefined
  const coverage = checkpoint.data.coverage?.find(c => c.answerVersion === version)
  if (!coverage) return undefined
  // The stored judgment is also the trace and spending-loop judgment. Reconcile evidence in that judgment, never
  // promote a fact only in the display: that used to show completion beside an unchanged missing-fact trace.
  const facts = checkpoint.data.requirements.map(r => {
    const status = coverage.entries.find(e => e.requirementId === r.id)?.status ?? 'unknown' as CoverageStatus
    return { id: r.id, text: r.text, status }
  })
  const answered = facts.filter(f => f.status === 'supported').length
  const followUp = checkpoint.data.followUp
  // The focused search found a fact free when its re-answer (always v2) was kept.
  const foundFree = Boolean(followUp?.reanswered && followUp.helped?.length && version >= 2)
  const stopReason = checkpoint.data.stopReason
  const isLatest = version === run.answers.reduce((max, a) => Math.max(max, a.version), 0)
  const tail = !isLatest || !stopReason ? [] : stopReason === 'complete' ? (run.spentMinor === 0 && run.decisions.length ? ['nothing bought'] : []) : [STOP_LABELS[stopReason].replace(/\.$/, '')]
  const line = [`${answered} of ${facts.length} answered`, ...(foundFree ? ['found free on a focused search'] : []), ...tail.map(t => t[0].toLowerCase() + t.slice(1))].join(' · ')
  return { answered, total: facts.length, facts, foundFree, ...(stopReason && isLatest ? { stopReason } : {}), line, judge: coverage.judge, ...(coverage.error ? { error: coverage.error } : {}) }
}
