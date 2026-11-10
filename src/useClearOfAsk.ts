import { useLayoutEffect, useState, type RefObject } from 'react'

/** Top for a fixed popover opened from the header: below its trigger and below the Ask button, so it never covers the
    first ask. Re-measured only when something can move them: element or page resizes, web fonts finishing, scrolling. */
export function useClearOfAsk(open: boolean, trigger: RefObject<HTMLElement | null>, gap = 12) {
  const [top, setTop] = useState(0)
  useLayoutEffect(() => {
    if (!open) return
    const place = () => setTop(Math.max(trigger.current?.getBoundingClientRect().bottom ?? 0, document.querySelector('button.ra-ask')?.getBoundingClientRect().bottom ?? 0) + gap)
    place()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(place)
    for (const element of [trigger.current, document.querySelector('button.ra-ask'), document.querySelector('.ra-home'), document.querySelector('.ra-home-wrap'), document.body]) if (element) observer?.observe(element)
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined
    fonts?.addEventListener?.('loadingdone', place)
    void fonts?.ready?.then(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { observer?.disconnect(); fonts?.removeEventListener?.('loadingdone', place); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, trigger, gap])
  return top
}
