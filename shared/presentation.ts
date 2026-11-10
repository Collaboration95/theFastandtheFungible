import { XRPL_LABEL, type PurchaseIntent, type Receipt, type PublicCandidate, type RunSnapshot } from './contracts/index.js'
import { RLUSD_TESTNET_ISSUER, type Asset } from './contracts/asset.js'

export const settlementAssetLabel = (asset?: Asset) => !asset || asset === 'XRP' ? 'XRPL Testnet' : asset.issuer === RLUSD_TESTNET_ISSUER ? 'RLUSD (Testnet)' : asset.label

export const money = (minor: number) => `S$${(minor / 100).toFixed(2)}`
export const ENV = { testnet: 'Testnet · test funds', simulated: 'Demo · simulated payments' } as const
export const environmentLabel = (settlement?: string) => settlement?.startsWith('XRPL') ? ENV.testnet : ENV.simulated
export const assetMoney = (minor: number, asset?: Asset) => asset && asset !== 'XRP' && asset.currency === 'SGT' ? `TEST-SGD ${(minor / 100).toFixed(2)} · stand-in for RLUSD · no real value` : money(minor)
export type PaymentPhase = 'quoted' | 'approved by policy' | 'submitted' | 'validated' | 'delivered' | 'verified' | 'challenged' | 'refunded' | 'failed' | 'skipped'
const PAYMENT: Record<PurchaseIntent['status'], PaymentPhase> = { DECIDED: 'approved by policy', QUOTED: 'quoted', RESERVED: 'approved by policy', SUBMITTING: 'submitted', SETTLED: 'validated', DELIVERY_PENDING: 'delivered', VERIFIED: 'verified', CLAIM_FAILED: 'challenged', CHALLENGED: 'challenged', REFUNDED: 'refunded', CHALLENGE_REJECTED: 'challenged', CHALLENGE_REFUSED: 'challenged', DELIVERY_FAILED: 'failed', FAILED_NOT_SETTLED: 'failed', SKIPPED: 'skipped' }
const LEVEL: Record<PurchaseIntent['status'], number> = { DECIDED: 0, QUOTED: 1, RESERVED: 2, SUBMITTING: 2, SETTLED: 3, DELIVERY_PENDING: 4, VERIFIED: 5, DELIVERY_FAILED: 3, FAILED_NOT_SETTLED: 2, SKIPPED: 0, CLAIM_FAILED: 4, CHALLENGED: 4, REFUNDED: 4, CHALLENGE_REJECTED: 4, CHALLENGE_REFUSED: 4 }
export const railLabel = (label?: string) => label === XRPL_LABEL ? 'XRPL TESTNET' : 'SIMULATED'
export function purchaseState(run: RunSnapshot, intent: PurchaseIntent) {
  const receipt = run.receipts.find(item => item.intentId === intent.intentId)
  const phase = PAYMENT[intent.status]
  const quarantined = phase === 'challenged' || phase === 'refunded'
  const failed = intent.status === 'DELIVERY_FAILED', notSettled = intent.status === 'FAILED_NOT_SETTLED'
  const ok = phase === 'verified', level = LEVEL[intent.status], amount = money(intent.amountMinor)
  const line = ok ? `Paid ${amount} · delivered · verified` : quarantined ? `Paid ${amount} · delivered · ✗ claim failed` : failed ? `Paid ${amount} · delivery failed` : notSettled ? 'Not settled · nothing charged' : phase === 'skipped' ? 'Skipped · nothing charged' : level >= 4 ? `Paid ${amount} · delivered · checking` : level === 3 ? `Paid ${amount} · checking delivery` : level === 2 ? `Paying ${amount}` : `Quoted ${amount}`
  return { intent, receipt, phase, level, quarantined, failed, notSettled, ok, line: intent.purchaseKind ? `${line} · ${intent.purchaseKind}` : line,
    title: ok ? 'Bought' : quarantined ? 'Proof failed' : failed ? 'Paid, not delivered' : notSettled || phase === 'skipped' ? 'Not bought' : 'Buying',
    fill: ok || quarantined ? 100 : level >= 4 ? 75 : level >= 3 ? 50 : level >= 2 ? 25 : 0,
    rail: railLabel(run.labels.settlement), ledgerIndex: receipt?.xrpl?.ledgerIndex, txHash: receipt?.xrpl?.txHash,
    explorerUrl: receipt?.xrpl?.explorerUrl, pendingSince: run.events.find(event => event.type === 'PURCHASE' && event.data?.intentId === intent.intentId && event.data?.status === 'SUBMITTING')?.at,
  }
}

export function receiptView(intent: PurchaseIntent, receipt: Receipt | undefined, candidate: PublicCandidate | undefined, settlement: RunSnapshot['labels']['settlement']) {
  return { purchaseKind: intent.purchaseKind, source: intent.source, intentId: intent.intentId, resourceId: intent.resourceId, writer: candidate?.publisher ?? intent.profileId,
        writerVerification: candidate?.verification ?? { status: 'unverified' }, credentialNotice: 'unsigned advisory; requires online check', asset: receipt?.xrpl?.asset ?? intent.quote?.payment?.asset ?? 'XRP', settlementAmount: receipt?.xrpl?.amountDrops ?? null, escrow: intent.escrow ?? null, priceMinor: intent.amountMinor, status: intent.status, verified: intent.status === 'VERIFIED', refunded: intent.status === 'REFUNDED', txHash: receipt?.xrpl?.txHash ?? null, explorerUrl: receipt?.xrpl?.explorerUrl ?? null, label: receipt?.label ?? settlement }
}

/** Exact disclosure defaults shared by adapters; no authority or mutable state. */
export function modeDisclosure(mode: 'corpus' | 'research' | 'decision' | 'publisher' | 'settlement'): string {
  return { corpus: 'Registry-labelled writers · credential identity requires online check', research: 'fixture · extractive-fixture', decision: 'fixture · metadata-fixture', publisher: 'local', settlement: 'SIMULATED SGD · no real funds' }[mode]
}
