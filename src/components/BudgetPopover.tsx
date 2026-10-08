import { useCallback, useRef, useState } from 'react'
import { money } from '../format'
import Roll from './Roll'
import { useDismiss } from '../useDismiss'
import BudgetSlider from './BudgetSlider'

/** Home's budget control: a chip that opens a popover with the notched slider and quick picks. */
export default function BudgetPopover({ value, onChange, disabled = false }: { value: number; onChange: (minor: number) => void; disabled?: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, box, close)
  return <div className="ra-budget" ref={box}>
    <button type="button" className="ra-budget-chip" aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => setOpen(value => !value)}>
      <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><path d="M10 6.5v7M12.2 8.2c-.4-.7-1.2-1-2.2-1-1.2 0-2 .6-2 1.4 0 2 4.4.8 4.4 2.9 0 .9-.9 1.5-2.2 1.5-1 0-1.9-.4-2.3-1.1" /></svg>
      {value === 0 ? 'Free' : <Roll text={money(value)} />}
      <svg className="chev" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 8l4.5 4.5L14.5 8" /></svg>
    </button>
    {open && <div className="ra-pop" role="dialog" aria-label="Budget">
      <BudgetSlider value={value} onChange={onChange} stops />
    </div>}
  </div>
}
