import { useEffect, type RefObject } from 'react'

/** Closes a popover on a press outside its box or on Escape. */
export function useDismiss(open: boolean, box: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => { if (!(event.target instanceof Node && box.current?.contains(event.target))) close() }
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close() } }
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc, true) }
  }, [open, box, close])
}
