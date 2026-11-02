/// <reference types="vite/client" />
import manifest from '../assets/cast/manifest.json'
import './cast.css'

// Vite owns URL rewriting, including a non-root deployment base.
const urls = import.meta.glob('../assets/cast/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
type ScoutPose = 'idle' | 'clarifying' | 'searching' | 'weighing' | 'paying' | 'verifying' | 'caught-a-lie' | 'done' | 'stopped'
type Writer = 'basis-points' | 'kopi-contrarian' | 'load-factor' | 'marketpulse-digest' | 'notfinancialtimes' | 'open-records' | 'the-fab-floor'
type WriterPose = 'listening' | 'paid' | 'verified'
type State = { who: 'scout'; pose: ScoutPose }
  | { who: 'purse'; pose: 'full' | 'spending' | 'refunded' | 'locked' | 'empty' | 'simulated' }
  | { who: Writer; pose: WriterPose }
  | { who: 'alphaleak'; pose: WriterPose | 'sneaky' | 'caught' | 'refunding' }
  | { who: 'receipt'; pose: 'printing' | 'verified' | 'refunded' | 'simulated' }
  | { who: 'ledger'; pose: 'closing' | 'closed' }
export type CastProps = State & { label?: string; size?: number }

/** State mark only: never starts a payment or infers settlement from elapsed time. */
export default function Cast({ who, pose, label, size = 64 }: CastProps) {
  const asset = manifest.find(item => item.who === who && item.pose === pose)
  if (!asset) return null
  const description = label ?? `${asset.label}${who === 'ledger' ? ' · illustration, not a live ledger clock' : who === 'purse' && pose === 'locked' ? ' · illustration, escrow is not implemented' : ''}`
  return <span role="img" aria-label={description} className="ra-cast" data-pose={pose} style={{ width: size, height: size }}>
    <img src={urls[`../assets/cast/${size <= 24 ? asset.iconFile : asset.file}`]} alt="" aria-hidden="true" width={size} height={size} draggable={false} />
  </span>
}
