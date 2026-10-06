import type { ReactNode } from 'react'
import { Mark } from '../format'

/** App shell: brand, the run crumb and the quiet provider slot over a sidebar and the page body. */
export default function Layout({ crumb, labels, nav, children }: { crumb?: string; labels?: ReactNode; nav?: ReactNode; children: ReactNode }) {
  return <div className="ra-app">
    <header className="ra-top">
      <div className="ra-brand"><Mark /><span>ResearchAgent</span></div>
      {crumb && <div className="ra-crumb"><span>Run</span><b>{crumb}</b></div>}
      <div className="ra-prov">{labels}</div>
    </header>
    <div className="ra-body">{nav}{children}</div>
  </div>
}
