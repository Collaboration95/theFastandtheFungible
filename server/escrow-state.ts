import type { EscrowQuote, EscrowStatus } from '../shared/contracts/escrow.js'
import type { Submission } from './xrpl.js'
export type EscrowOperation = 'create' | 'finish' | 'cancel'
/** Private durable state. Only publicStatus is allowed on the API. */
export type EscrowRecord = { intentId: string; secret: string; reveal?: { key: string; finishHash: string; ledgerIndex: number; transaction?: Record<string, unknown> }; quote: EscrowQuote; publicStatus: EscrowStatus }
export type EscrowOutbox = Submission & { operation: EscrowOperation; intentId: string }
