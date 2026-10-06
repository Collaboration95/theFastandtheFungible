import type { ReactNode } from 'react'
import { Mark } from '../format'

/** App shell: brand, the run crumb, provider labels and the page action, over the page body. */
export default function Layout({ crumb, labels, action, children }: { crumb?: string; labels?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return <div className="ra-app">
    <header className="ra-top">
      <div className="ra-brand"><Mark /><span>ResearchAgent</span></div>
      {crumb && <div className="ra-crumb"><span>Run</span><b>{crumb}</b></div>}
      <div className="ra-prov">{labels}</div>
      {action}
    </header>
    {children}
  </div>
}
