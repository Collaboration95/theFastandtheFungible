import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { Mark } from '../format'

/** App shell: the sidebar toggle, brand, the quiet provider slot over a sidebar and the page body. */
export default function Layout({ labels, toggle, nav, navWidth, children }: { labels?: ReactNode; toggle?: ReactNode; nav?: ReactNode; navWidth?: number; children: ReactNode }) {
  // Keyboard users reach the question box in one Tab instead of fifteen (R8 H8-17): the box on Home and in a chat, the page body on a run.
  const skip = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const target = document.querySelector<HTMLElement>('main textarea') ?? document.querySelector<HTMLElement>('main')
    if (!target) return
    // Every page's <main> already carries tabindex=-1; this covers one that doesn't.
    if (!target.matches('textarea') && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus()
  }
  return <div className="ra-app">
    {/* The recorded replay sits under the site header and has no question box; the skip link belongs to the live app. */}
    {import.meta.env.MODE !== 'browser-demo' && <a className="ra-skip" href="#main" onClick={skip}>Skip to question</a>}
    <header className="ra-top">
      {toggle}
      <div className="ra-brand"><Mark /><span>ResearchAgent</span></div>
      <div className="ra-prov">{typeof window !== 'undefined' && window.location.protocol === 'app:' && document.querySelector('meta[name="researchagent-backend"]')?.getAttribute('content') && <span className="mono">Backend: {document.querySelector('meta[name="researchagent-backend"]')?.getAttribute('content')}</span>}{labels}</div>
    </header>
    {/* --nav-w: the open sidebar's width, so toasts centre on the content beside it. */}
    <div className="ra-body" style={navWidth ? { '--nav-w': `${navWidth}px` } as CSSProperties : undefined}>{nav}{children}</div>
  </div>
}
