import { useEffect, useState } from 'react'
import type { AnswerDraft } from '../../shared/contracts/index.js'

/* The answer as the model writes it (streaming). Every word here is UNVERIFIED and says so: no citation chips, a
   "drafting" label, and a pending mark where the chips will go. Once the exact-passage check runs, rejected claims
   are struck through, then the validated answer takes over (onSettled). */

const GLYPH = { CHALLENGES: '▼', SUPPORTS: '▲', UNCERTAIN: '◆' } as const
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Characters revealed so far: at least ~180 a second, faster the further behind it is, so bursts and replays read as typing. */
function useTyped(total: number): number {
  const [count, setCount] = useState(0)
  const [instant] = useState(reducedMotion)
  useEffect(() => {
    if (instant) return
    let frame = requestAnimationFrame(function tick() {
      setCount(c => c >= total ? c : Math.min(total, c + Math.max(3, Math.ceil((total - c) / 45))))
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [total, instant])
  return instant ? total : Math.min(count, total)
}

/** How long the struck-through claims stay on screen before the validated answer replaces the draft. */
const HOLD_MS = { removed: 1600, clean: 300 }

export default function DraftAnswer({ draft, onSettled }: { draft: AnswerDraft; onSettled: (key: string) => void }) {
  const texts = draft.claims.map(claim => claim.text)
  const total = texts.reduce((sum, text) => sum + text.length, 0)
  const count = useTyped(total)
  const starts = texts.map((_, index) => texts.slice(0, index).reduce((sum, text) => sum + text.length, 0))
  const typed = texts.map((text, index) => text.slice(0, Math.max(0, count - starts[index])))
  // The caret sits where typing is; while the model is still writing it waits at the end of the last claim.
  const behind = typed.findIndex((text, index) => text.length < texts[index].length)
  const caret = behind >= 0 ? behind : draft.status === 'WRITING' ? texts.length - 1 : -1
  const removed = new Set(draft.removed ?? [])
  const checked = draft.status !== 'WRITING'
  const done = count >= total && draft.status === 'KEPT'
  const hold = removed.size ? HOLD_MS.removed : HOLD_MS.clean
  const key = `${draft.runId}:${draft.version}`
  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => onSettled(key), hold)
    return () => clearTimeout(timer)
  }, [done, hold, onSettled, key])
  const label = draft.status === 'WRITING' ? (draft.conditional ? 'Drafting · kept only if it answers more' : 'Drafting · unverified')
    : removed.size ? `Citation check removed ${removed.size}` : draft.conditional && draft.status === 'CHECKING' ? 'Citations checked · judging coverage' : 'Citations checked'
  const caretMark = <span className="ra-caret" aria-hidden="true" />

  return <>
    <section className="ra-verdict is-draft" aria-label="Research answer draft" aria-busy="true">
      <div className="ra-vlabel"><h2>Short answer</h2><span className={`ra-draft-k${checked ? ' is-checking' : ''}`} role="status">{label}</span></div>
      {typed[0]
        ? <p className="ra-vtext"><span className={removed.has(texts[0]) ? 'ra-struck' : undefined}>{typed[0]}</span>{caret === 0 && caretMark}</p>
        : <div className="ra-vtext is-skel" aria-hidden="true"><i style={{ width: '88%' }} /><i style={{ width: '52%' }} /></div>}
      <p className="ra-draft-note">Unverified draft: each claim is checked against its exact source passage before it is kept.</p>
    </section>
    {typed.some(Boolean) && <section className="ra-claims is-draft" aria-label="Draft claims">
      <div className="ra-group"><h3>Draft claims <em>{texts.length}</em></h3><ul>{typed.map((text, index) => {
        if (!text && index !== caret) return null
        const stance = draft.claims[index].stance
        const gone = removed.has(texts[index])
        const complete = text.length === texts[index].length
        return <li key={index} className={`ra-claim${gone ? ' is-gone' : ''}`}>
          <span className={`ra-sg${stance ? ` s-${stance.toLowerCase()}` : ' is-pending'}`} aria-hidden="true">{stance ? GLYPH[stance] : '•'}</span>
          <p>{gone && <span className="ra-new">REMOVED</span>}{text}{index === caret && caretMark}
            {complete && !gone && <span className={`ra-cite-pending${checked ? ' is-ok' : ''}`} title={checked ? 'Citation matches its passage' : 'Citation not yet checked'} aria-label={checked ? 'citation checked' : 'citation pending'}>{checked ? '✓' : '…'}</span>}</p>
        </li>
      })}</ul></div>
    </section>}
  </>
}
