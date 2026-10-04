import type { ReactNode } from 'react'

export default function Layout({ children, aside, header }: { children: ReactNode; aside?: ReactNode; header?: ReactNode }) {
  return <div className="ra-layout">
    <header className="ra-header"><h1>ResearchAgent</h1><p>LLMs write. A decision model chooses. Code pays.</p>{header}</header>
    <main className="ra-main">{children}</main>
    {aside !== undefined && <aside className="ra-aside" aria-label="Agent internals">{aside}</aside>}
  </div>
}
