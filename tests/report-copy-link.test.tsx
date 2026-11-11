// Export's "Copy link" only offers a link someone else can open. In the Mac app the run's address is `app://…`, which
// opens nowhere but this computer, so the menu hides the control instead of copying a useless link.
import { afterEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ReportButton from '../src/components/ReportButton'
import { shareableRunLink } from '../src/share-link'
import { Store } from '../server/store.js'

afterEach(() => { vi.unstubAllGlobals() })
function doneRun() {
  const store = new Store(':memory:')
  const run = store.createRun('orchids', 200, { research: 'fixture', decision: 'fixture', publisher: 'local', settlement: 'XRPL TESTNET · no real value' })
  store.updateRun(run.runId, { phase: 'DONE' })
  const result = store.getRun(run.runId); store.close(); return result
}
const menu = (href: string) => {
  vi.stubGlobal('window', { location: new URL(href) })
  return renderToStaticMarkup(<ReportButton run={doneRun()} onReport={() => {}} />)
}

it('copies only web addresses', () => {
  expect(shareableRunLink(new URL('app://researchagent/?run=abc'))).toBeNull()
  expect(shareableRunLink(new URL('file:///Applications/ResearchAgent.app/index.html'))).toBeNull()
  expect(shareableRunLink(new URL('http://127.0.0.1:5100/?run=abc'))).toBe('http://127.0.0.1:5100/?run=abc')
  expect(shareableRunLink(new URL('https://example.org/runs/abc'))).toBe('https://example.org/runs/abc')
})

it('hides Copy link in the Mac app and keeps it in the local web app', () => {
  const desktop = menu('app://researchagent/?run=abc')
  expect(desktop).toContain('Download receipts.json')
  expect(desktop).not.toContain('Copy link')
  expect(menu('http://127.0.0.1:5100/?run=abc')).toContain('Copy link')
})
