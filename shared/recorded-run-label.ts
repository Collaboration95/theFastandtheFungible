import type { RunSnapshot } from './contracts/index.js'

export function recordedRunLabel(run: RunSnapshot): string {
  const fictional = run.candidates.some(c => c.license.kind === 'SYNTHETIC')
  const provider = run.answers.at(-1)?.provider
  const research = provider === 'fixture' || !provider && run.labels.research.startsWith('fixture') ? 'fixture answers' : provider ? 'live answers' : 'answers pending'
  if (fictional) return `Recorded run · ${research} · fictional writers and content · ${run.labels.settlement.includes('TESTNET') ? 'XRPL Testnet, no real value' : 'simulated payments, no real value'}`
  return `Recorded run · ${research} · ${run.labels.settlement.includes('TESTNET') ? 'XRPL Testnet' : 'simulated payments'}`
}
