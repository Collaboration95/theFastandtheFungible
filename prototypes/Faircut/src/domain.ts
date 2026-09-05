export const PROJECT_ID = 'project_japan_travel_20s' as const
export const MANDATE_ID = 'mandate_leah_launch_v1' as const
export const PURCHASE_ID = 'purchase_dawn_current_12s' as const
export const MAX_DROPS = 10_000 as const
export const PRICE_DROPS = 8_000 as const
export const PLACEMENT_START_MS = 5_500 as const
export const PLACEMENT_DURATION_MS = 12_000 as const

export type CandidateId = 'neon-pilgrim' | 'dawn-current' | 'paper-horizon'
export type DemoPhase = 'rough-cut' | 'compare' | 'blocked' | 'license' | 'deliver' | 'final-cut'
export type Scenario = 'happy' | 'quote_changed' | 'payment_failed' | 'payment_unconfirmed' | 'delivery_mismatch' | 'risk_unavailable'
export type PurchaseState =
  | 'DRAFT'
  | 'DISCOVERED'
  | 'EVALUATING'
  | 'BLOCKED'
  | 'ELIGIBLE'
  | 'AUTHORIZED'
  | 'SIMULATED_SETTLED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_UNCONFIRMED'
  | 'FULFILMENT_VERIFIED'
  | 'FULFILMENT_EXCEPTION'

export type RightsResult = 'PASS' | 'FAIL' | 'UNKNOWN'

export interface RightsCheck {
  code: string
  label: string
  result: RightsResult
  observed: string
  expected: string
  evidence: string
}

export interface Candidate {
  id: CandidateId
  title: string
  creator: string
  creatorRef: string
  provider: string
  providerId: string
  priceDrops: number
  previewUrl: string
  cleanUrl?: string
  durationMs: number
  assetDigest: string
  policyHash: string
  provenance: 'SIGNED_FIXTURE' | 'UNAVAILABLE' | 'INVALID'
  provenanceLabel: string
  attribution: string
  creative: {
    timingFit: number
    moodFit: number
    transitionFit: number
    sonicClarity: number
    summary: string
    rationale: string[]
  }
  rights: RightsCheck[]
  rightDecision: 'ELIGIBLE' | 'BLOCKED'
  waveform: number[]
}

export const candidates: Candidate[] = [
  {
    id: 'neon-pilgrim',
    title: 'Neon Pilgrim — 12s rise',
    creator: 'Rin Vale',
    creatorRef: 'did:faircut:creator:rin-vale',
    provider: 'Nightjar Direct',
    providerId: 'nightjar-direct',
    priceDrops: 2_000,
    previewUrl: '/media/neon-pilgrim-preview.mp3',
    durationMs: 12_000,
    assetDigest: 'sha256:asset-neon-pilgrim-preview-v1',
    policyHash: 'sha256:policy-neon-pilgrim-personal-v1',
    provenance: 'INVALID',
    provenanceLabel: 'Signer mismatch',
    attribution: 'Rin Vale — preview terms only',
    creative: {
      timingFit: 94,
      moodFit: 98,
      transitionFit: 95,
      sonicClarity: 88,
      summary: 'Strongest tension-to-release arc for the reveal.',
      rationale: ['Hits the reveal beat at 00:05.500', 'Bright lift under the closing title', 'Most immediate match to Leah’s brief'],
    },
    rights: [
      { code: 'COMMERCIAL_USE_NOT_PERMITTED', label: 'Commercial social use', result: 'FAIL', observed: 'Personal use only', expected: 'Commercial social', evidence: 'permission[0].constraint[purpose]' },
      { code: 'TERRITORY_MISSING_JP', label: 'Japan territory', result: 'FAIL', observed: 'SG only', expected: 'SG + JP', evidence: 'permission[0].constraint[spatial]' },
      { code: 'TERM_TOO_NARROW', label: 'Six-month term', result: 'PASS', observed: '6 months', expected: '6 months', evidence: 'permission[0].constraint[dateTime]' },
      { code: 'DURATION_MATCH', label: '12-second placement', result: 'PASS', observed: '12,000 ms', expected: '12,000 ms', evidence: 'faircut:durationMs' },
      { code: 'RIGHTS_HOLDER_PAYEE_MISMATCH', label: 'Rights-holder / payee binding', result: 'FAIL', observed: 'Signer ≠ claimed payee', expected: 'Bound creator payee', evidence: 'provenance.signerIdentity' },
    ],
    rightDecision: 'BLOCKED',
    waveform: [12, 22, 18, 38, 32, 54, 48, 68, 58, 82, 66, 92, 72, 50, 60, 78, 70, 46, 56, 30, 40, 24, 28, 16],
  },
  {
    id: 'dawn-current',
    title: 'Dawn Current — 12s sting',
    creator: 'Mika Reyes',
    creatorRef: 'did:faircut:creator:mika-reyes',
    provider: 'Mika Direct Licences',
    providerId: 'mika-direct',
    priceDrops: 8_000,
    previewUrl: '/media/dawn-current-preview.mp3',
    cleanUrl: '/api/providers/mika-direct/assets/dawn-current/master',
    durationMs: 12_000,
    assetDigest: 'sha256:bb17a03c1190de7b5fbdf941c1c99e4edf541579673c67000d73db31e44b19b3',
    policyHash: 'sha256:2387466cfd408810d3b6cca7c0384536a40546b92656335acc1ca1eb3f4c4acb',
    provenance: 'SIGNED_FIXTURE',
    provenanceLabel: 'Signed provenance fixture · C2PA unavailable',
    attribution: 'Music by Mika Reyes',
    creative: {
      timingFit: 92,
      moodFit: 88,
      transitionFit: 96,
      sonicClarity: 94,
      summary: 'Best eligible fit: the cleanest title handoff.',
      rationale: ['Leaves breathing room before the reveal', 'Resolves without masking the closing title', 'Highest transition and clarity scores among eligible cues'],
    },
    rights: [
      { code: 'COMMERCIAL_USE_ALLOWED', label: 'Commercial social use', result: 'PASS', observed: 'Commercial social', expected: 'Commercial social', evidence: 'permission[0].constraint[purpose]' },
      { code: 'TERRITORY_SG', label: 'Singapore territory', result: 'PASS', observed: 'SG', expected: 'SG + JP', evidence: 'permission[0].constraint[spatial]' },
      { code: 'TERRITORY_JP', label: 'Japan territory', result: 'PASS', observed: 'JP', expected: 'SG + JP', evidence: 'permission[0].constraint[spatial]' },
      { code: 'TERM_MATCH', label: 'Six-month term', result: 'PASS', observed: '6 months', expected: '6 months', evidence: 'permission[0].constraint[dateTime]' },
      { code: 'DURATION_MATCH', label: '12-second placement', result: 'PASS', observed: '12,000 ms', expected: '12,000 ms', evidence: 'faircut:durationMs' },
      { code: 'PROVENANCE_PRESENT', label: 'Provenance evidence', result: 'PASS', observed: 'Signed fixture', expected: 'Required', evidence: 'provenance.kind' },
      { code: 'RIGHTS_HOLDER_PAYEE_BOUND', label: 'Rights-holder / payee binding', result: 'PASS', observed: 'Mika Reyes → rMikaDemo…7Q', expected: 'Bound creator payee', evidence: 'creator.identityRef + quote.payTo' },
      { code: 'ATTRIBUTION_DUTY', label: 'Attribution duty', result: 'PASS', observed: 'Music by Mika Reyes', expected: 'Displayed on receipt', evidence: 'duty[action=attribute]' },
    ],
    rightDecision: 'ELIGIBLE',
    waveform: [10, 14, 20, 18, 26, 34, 30, 44, 48, 42, 54, 64, 58, 70, 66, 76, 72, 58, 64, 48, 38, 44, 30, 24],
  },
  {
    id: 'paper-horizon',
    title: 'Paper Horizon — 12s bed',
    creator: 'Jo Okada',
    creatorRef: 'did:faircut:creator:jo-okada',
    provider: 'Open Loom Audio',
    providerId: 'open-loom',
    priceDrops: 9_000,
    previewUrl: '/media/paper-horizon-preview.mp3',
    durationMs: 12_000,
    assetDigest: 'sha256:asset-paper-horizon-clean-v1',
    policyHash: 'sha256:policy-paper-horizon-v1',
    provenance: 'SIGNED_FIXTURE',
    provenanceLabel: 'Signed provenance fixture · C2PA unavailable',
    attribution: 'Music by Jo Okada',
    creative: {
      timingFit: 86,
      moodFit: 84,
      transitionFit: 79,
      sonicClarity: 91,
      summary: 'Steady, eligible alternative with a gentler landing.',
      rationale: ['Reliable bed through the middle beat', 'Leaves the title very clear', 'Less lift than Dawn Current at the reveal'],
    },
    rights: [
      { code: 'COMMERCIAL_USE_ALLOWED', label: 'Commercial social use', result: 'PASS', observed: 'Commercial social', expected: 'Commercial social', evidence: 'permission[0].constraint[purpose]' },
      { code: 'TERRITORY_COVERAGE', label: 'SG + JP territories', result: 'PASS', observed: 'SG + JP', expected: 'SG + JP', evidence: 'permission[0].constraint[spatial]' },
      { code: 'TERM_MATCH', label: 'Six-month term', result: 'PASS', observed: '6 months', expected: '6 months', evidence: 'permission[0].constraint[dateTime]' },
      { code: 'DURATION_MATCH', label: '12-second placement', result: 'PASS', observed: '12,000 ms', expected: '12,000 ms', evidence: 'faircut:durationMs' },
      { code: 'PROVENANCE_PRESENT', label: 'Provenance evidence', result: 'PASS', observed: 'Signed fixture', expected: 'Required', evidence: 'provenance.kind' },
      { code: 'RIGHTS_HOLDER_PAYEE_BOUND', label: 'Rights-holder / payee binding', result: 'PASS', observed: 'Jo Okada → rOpenLoom…3M', expected: 'Bound creator payee', evidence: 'creator.identityRef + quote.payTo' },
    ],
    rightDecision: 'ELIGIBLE',
    waveform: [26, 30, 34, 32, 36, 40, 42, 38, 44, 46, 48, 42, 50, 52, 46, 44, 48, 42, 40, 36, 34, 30, 28, 26],
  },
]

export const phaseLabels: Array<{ id: DemoPhase; label: string; eyebrow: string }> = [
  { id: 'rough-cut', label: 'Rough cut', eyebrow: '01' },
  { id: 'compare', label: 'Compare', eyebrow: '02' },
  { id: 'blocked', label: 'Blocked', eyebrow: '03' },
  { id: 'license', label: 'License', eyebrow: '04' },
  { id: 'deliver', label: 'Deliver', eyebrow: '05' },
  { id: 'final-cut', label: 'Final cut', eyebrow: '06' },
]

export function formatDrops(amount: number) {
  return new Intl.NumberFormat('en-SG').format(amount)
}

export function formatTime(ms: number) {
  const totalSeconds = Math.max(0, ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(3).padStart(6, '0')}`
}

export function phaseIndex(phase: DemoPhase) {
  return phaseLabels.findIndex((item) => item.id === phase)
}
