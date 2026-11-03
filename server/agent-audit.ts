import type { AuditEntry } from './audit.js'
/** Replay operator control history at the money gate. A settle after revocation is valid for an earlier signature. */
export function auditAgentAuthority(entries: AuditEntry[]) {
  const agents = new Map<string, { paused: boolean; revoked: boolean; maxMinor: number; dailyMinor: number }>()
  const budgets = new Map<string, number>()
  const violations: { rule: 'agent_authority'; runId: string; evidence: string }[] = []
  for (const entry of entries) {
    if (entry.surface !== 'agent') continue
    const { principal, data } = entry
    if (entry.kind === 'agent-create') agents.set(principal, { paused: Boolean(data.paused), revoked: Boolean(data.revoked), maxMinor: Number(data.maxMinor), dailyMinor: Number(data.dailyMinor) })
    const agent = agents.get(principal)
    if (entry.kind === 'pause' && agent) { agent.paused = Boolean(data.paused); agent.revoked ||= Boolean(data.revoked) }
    if (entry.kind === 'admission') budgets.set(entry.runId!, Number(data.admittedMinor) + Number(data.hireReserveMinor ?? 0))
    const moneyGate = ['admission', 'reserve', 'sign'].includes(entry.kind) || entry.kind === 'escrow-sign' && data.operation === 'create'
    if (moneyGate && (!agent || agent.paused || agent.revoked || !budgets.has(entry.runId!) || budgets.get(entry.runId!)! > agent.maxMinor)) {
      violations.push({ rule: 'agent_authority', runId: entry.runId ?? '', evidence: `audit seq ${entry.seq}: missing, paused, revoked or over-cap principal` })
    }
    if (entry.kind === 'admission' && agent && Number(data.admittedMinor) + Number(data.hireReserveMinor ?? 0) > Number(data.surfaceRemainingMinor)) {
      violations.push({ rule: 'agent_authority', runId: entry.runId!, evidence: `audit seq ${entry.seq}: allowance exceeds principal headroom` })
    }
  }
  return violations
}
