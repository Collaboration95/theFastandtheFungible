import type { Answer } from './contracts/answer.js'

/** Snapshot provenance, separate from the signed/exported receipts contract. Absence means unknown. */
export type ResearchProvenance = { provider: Answer['provider']; fallback: boolean }

export const buyingLabels = { fixture: 'rule-based buying', live: 'model-judged buying' } as const

export const proofEnvironmentLabel = (env: { surface: 'hosted' | 'local'; models: 'fixture' | 'live'; research?: ResearchProvenance }) => {
  const research = env.research
  const answers = research ? `${research.provider === 'fixture' || research.fallback ? 'offline extract answers' : 'live answers'}, ` : ''
  return `${env.surface === 'hosted' ? 'Shared ' : ''}XRPL Testnet demo · ${answers}${buyingLabels[env.models]} · no real value`
}
