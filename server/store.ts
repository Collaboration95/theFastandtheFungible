import type { Answer, ContentEnvelope, DecisionRound, Grant, Impact, ModeLabels, PurchaseIntent, Receipt, RunSnapshot, TraceEvent } from '../shared/contracts/index.js'
export class Store {
  constructor(readonly path: string = 'data/app.db') {}
  createRun(_question: string, _budgetMinor: number, _labels?: ModeLabels): RunSnapshot { throw new Error('TODO(W1-LEDGER)') }
  getRun(_runId: string): RunSnapshot { throw new Error('TODO(W1-LEDGER)') }
  listRuns(): RunSnapshot[] { return [] }
  updateRun(_runId: string, _patch: Partial<RunSnapshot>): RunSnapshot { throw new Error('TODO(W1-LEDGER)') }
  appendEvent(_runId: string, _event: Omit<TraceEvent, 'id' | 'runId' | 'at'>): TraceEvent { throw new Error('TODO(W1-LEDGER)') }
  addAnswer(_runId: string, _answer: Answer, _impact?: Impact): void { throw new Error('TODO(W1-LEDGER)') }
  addDecision(_runId: string, _decision: DecisionRound): void { throw new Error('TODO(W1-LEDGER)') }
  addContent(_runId: string, _content: ContentEnvelope): void { throw new Error('TODO(W1-LEDGER)') }
  getIntent(_intentId: string): PurchaseIntent | undefined { return undefined }
  reserveIntent(_intent: PurchaseIntent): PurchaseIntent { throw new Error('TODO(W1-LEDGER)') }
  updateIntent(_intentId: string, _patch: Partial<PurchaseIntent>): PurchaseIntent { throw new Error('TODO(W1-LEDGER)') }
  recordSettlement(_intentId: string, _receipt: Receipt, _deliveryToken: string): void { throw new Error('TODO(W1-LEDGER)') }
  getDeliveryToken(_intentId: string): string | undefined { return undefined }
  addGrant(_grant: Grant, _content: ContentEnvelope): void { throw new Error('TODO(W1-LEDGER)') }
  close(): void {}
}
