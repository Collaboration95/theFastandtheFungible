import Icon from './Icon'
import { useCallback, useRef, useState } from 'react'
import { money } from '../format'
import { useDismiss } from '../useDismiss'
import BudgetPicker from './BudgetPicker'

/** Home's budget control: a chip that opens a popover with the notched slider and quick picks. */
export default function BudgetPopover({ value, onChange, disabled = false, max }: { value: number; onChange: (minor: number) => void; disabled?: boolean; max?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, box, close)
  return <div className="ra-budget" ref={box}>
    <button type="button" className="ra-budget-chip" aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => setOpen(value => !value)}>
      <Icon name="coin" />
      {value === 0 ? 'Free' : money(value)}
      <Icon name="down" size={16} />
    </button>
    {open && <div className="ra-pop" role="dialog" aria-label="Budget">
      <BudgetPicker value={value} onChange={onChange} max={max} />
    </div>}
  </div>
}
