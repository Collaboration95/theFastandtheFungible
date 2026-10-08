import type { CSSProperties, ReactNode } from 'react'
import { Mark } from '../format'

/** App shell: the sidebar toggle, brand, the quiet provider slot over a sidebar and the page body. */
export default function Layout({ labels, toggle, nav, navWidth, children }: { labels?: ReactNode; toggle?: ReactNode; nav?: ReactNode; navWidth?: number; children: ReactNode }) {
  return <div className="ra-app">
    <header className="ra-top">
      {toggle}
      <div className="ra-brand"><Mark /><span>ResearchAgent</span></div>
      <div className="ra-prov">{labels}</div>
    </header>
    {/* --nav-w: the open sidebar's width, so toasts centre on the content beside it. */}
    <div className="ra-body" style={navWidth ? { '--nav-w': `${navWidth}px` } as CSSProperties : undefined}>{nav}{children}</div>
  </div>
}
