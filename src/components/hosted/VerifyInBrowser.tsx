import Icon from '../Icon'
import { useState } from 'react'
import type { RunSnapshot } from '../../../shared/contracts'
import type { BrowserVerification } from '../../verify/browser'

const mark = { PASS: 'check', FAIL: 'close', SKIP: 'circle' } as const
const word = { PASS: 'passed', FAIL: 'failed', SKIP: 'not checked' } as const
/** Simulated payments have no ledger to name: say what the check is without claiming XRPL Testnet. */
const simulatedTitle: Record<string, string> = { ledger: 'Payments on a public ledger', anchor: 'Answer anchored on a public ledger' }
/** Re-checks a finished run's receipts with the TypeScript verifier, in this browser, against a public XRPL Testnet node. */
export default function VerifyInBrowser({ run }: { run: RunSnapshot }) {
  const [state, setState] = useState<{ step: 'idle' | 'fetch' | 'check' | 'done' | 'error'; result?: BrowserVerification; error?: string }>({ step: 'idle' })
  const testnet = run.labels.settlement.startsWith('XRPL')
  const start = async () => {
    setState({ step: 'fetch' })
    try {
      const response = await fetch(`/runs/${encodeURIComponent(run.runId)}/receipts.json`)
      if (!response.ok) throw new Error('receipts')
      const bundle: unknown = await response.json()
      setState({ step: 'check' })
      const { verifyInBrowser } = await import('../../verify/browser')
      setState({ step: 'done', result: await verifyInBrowser(bundle) })
    } catch (error) {
      setState({ step: 'error', error: error instanceof Error && error.message === 'receipts' ? 'This run’s receipts could not be downloaded.' : 'The checks could not finish in this browser.' })
    }
  }
  const result = state.result
  const failed = result?.checks.filter(check => check.status === 'FAIL').length ?? 0
  const passed = result?.checks.filter(check => check.status === 'PASS').length ?? 0
  const skipped = result?.checks.filter(check => check.status === 'SKIP').length ?? 0
  return <section className="ra-hv" aria-labelledby="ra-hv-title">
    <h2 id="ra-hv-title">{testnet ? 'Verify on XRPL in your browser' : 'Verify in your browser'}</h2>
    {state.step === 'idle' && <><p>Re-check this run’s receipts here: writer signatures, passage hashes and the audit log{testnet ? ', then every payment on a public XRPL Testnet node' : ''}. The result doesn’t rely on our server.</p>
      <button type="button" className="ra-btn" onClick={() => void start()}>Run the checks</button></>}
    {(state.step === 'fetch' || state.step === 'check') && <p role="status" className="ra-hv-busy"><span className="ra-spin" aria-hidden="true" />{state.step === 'fetch' ? 'Downloading receipts.json…' : testnet ? 'Checking signatures and reading XRPL Testnet…' : 'Checking signatures and hashes…'}</p>}
    {state.step === 'error' && <><p role="alert" className="ra-err">{state.error} Nothing was changed.</p><button type="button" className="ra-btn" onClick={() => void start()}>Try again</button></>}
    {result && <div>
      <p role="status" className={`ra-hv-head ${result.ok ? 'is-ok' : 'is-bad'}`}>{result.ok ? skipped ? `${passed} passed · ${skipped} not checked` : `All ${passed} checks passed` : `${failed} of ${result.checks.length} checks failed`}{result.ok && !testnet && <small> · ledger checks skipped: simulated payments</small>}</p>
      <ul className="ra-hv-groups">{result.groups.map(group => <li key={group.id} className={`is-${group.status.toLowerCase()}`}>
        <details open={group.status === 'FAIL'}>
          <summary><i aria-hidden="true"><Icon name={mark[group.status]} size={16} /></i><span>{(!testnet && simulatedTitle[group.id]) || group.title}</span><small>{group.status === 'SKIP' ? testnet || group.id === 'identity' ? 'not checked' : 'simulated' : `${group.passed}/${group.total}`}<span className="ra-sr"> {word[group.status]}</span></small></summary>
          <ul>{group.checks.map((check, index) => <li key={index}><span role="img" aria-label={word[check.status]}><Icon name={mark[check.status]} size={16} /></span><span><b className="mono">{check.check}</b> {check.detail}</span></li>)}</ul>
        </details>
      </li>)}</ul>
      <p className="ra-note">Ran in this browser{result.endpoint ? `, reading ${result.endpoint} (read-only)` : ''}. Same checks as the <code>researchagent verify</code> command.</p>
      <button type="button" className="ra-link" onClick={() => void start()}>Run again</button>
    </div>}
  </section>
}
