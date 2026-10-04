import { Children, Fragment, isValidElement, useState, type ReactNode } from 'react'
import { StageContext } from './StageContext'

export default function Layout({ children, aside, header }: { children: ReactNode; aside?: ReactNode; header?: ReactNode }) {
  const [view, setView] = useState('Answer')
  const main = Children.toArray(children)
  const answer = main.flatMap(child => isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment ? Children.toArray(child.props.children) : [child]).find(child => isValidElement<{ run?: { runId: string; question: string } }>(child) && child.props.run)
  const currentRun = isValidElement<{ run?: { runId: string; question: string } }>(answer) ? answer.props.run : undefined
  const internals = isValidElement<{ children?: ReactNode }>(aside) && aside.type === Fragment ? Children.toArray(aside.props.children) : []
  const staged = internals.length >= 4
  return <StageContext.Provider value={currentRun}><div className="ra-layout">
    <header className="ra-header"><div><h1>ResearchAgent</h1><p>LLMs write. A decision model chooses. Code pays.</p></div>{header}</header>
    {staged && <><div className="ra-wallet-strip">{internals[0]}</div><nav className="ra-stage-nav" aria-label="Research stage">{['Answer', 'Decisions', 'Wire', 'Activity'].map(name => <button type="button" key={name} aria-pressed={view === name} onClick={event => { setView(name); event.currentTarget.closest('nav')?.scrollIntoView({ block: 'start' }) }}>{name}</button>)}</nav></>}
    <main className="ra-main" hidden={staged && view !== 'Answer'}>{children}</main>
    {staged ? <aside className="ra-stage-internals" aria-label="Agent internals">
      <div hidden={view !== 'Decisions'}>{internals[1]}</div>
      <div hidden={view !== 'Activity'}>{internals[2]}</div>
      <div hidden={view !== 'Wire'}>{internals[3]}</div>
    </aside> : aside !== undefined && <aside className="ra-aside" aria-label="Agent internals">{aside}</aside>}
  </div></StageContext.Provider>
}
