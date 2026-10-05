import { useEffect, useState } from 'react'
import type { Ask as AskInput, Citation, PublicCandidate, RunSnapshot } from '../shared/contracts/index.js'
import { ask, createReport, getRun, retryDelivery, streamRun } from './api'
import Ask from './components/Ask'
import Answer from './components/Answer'
import Sources, { getAccessibleContent } from './components/Sources'
import Passage from './components/Passage'
import Impact from './components/Impact'
import ReportButton from './components/ReportButton'
import Layout from './components/Layout'
import Activity from './components/Activity'
import DecisionTable from './components/DecisionTable'
import Budget from './components/Budget'
import Wire from './components/Wire'
import Ledger from './components/Ledger'
import Modes from './components/Modes'
import FaultDemo from './components/FaultDemo'

const activeKey = 'researchagent.october.active-run'
export default function App() {
  const [run, setRun] = useState<RunSnapshot>()
  const [sending, setSending] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [error, setError] = useState('')
  const [reportUrl, setReportUrl] = useState('')
  const [passage, setPassage] = useState<{ candidate: PublicCandidate; citation?: Citation }>()
  const active = !!run && !['DONE', 'FAILED', 'STOPPED'].includes(run.phase)
  useEffect(() => {
    document.title = 'ResearchAgent · Perplexity with a wallet'
    const id = localStorage.getItem(activeKey)
    if (!id) return
    let cancelled = false
    void getRun(id).then(value => { if (!cancelled) setRun(value) }).catch(() => localStorage.removeItem(activeKey))
    return () => { cancelled = true }
  }, [])
  const runId = run?.runId
  useEffect(() => {
    if (!runId) return
    return streamRun(runId, { onSnapshot: setRun, onEvent: () => {}, onError: () => setError('Connection interrupted. The server preserves the run and reconnects automatically.') })
  }, [runId])
  const sendAsk = async (input: AskInput) => {
    setSending(true); setError(''); setPassage(undefined); setReportUrl('')
    try { const next = await ask(input); localStorage.setItem(activeKey, next.runId); setRun(next) }
    catch { setError('The API is unavailable. Start the demo processes, then ask again.') }
    finally { setSending(false) }
  }
  const openCitation = (citation: Citation) => {
    const candidate = run?.candidates.find(c => c.resourceId === citation.resourceId && c.version === citation.version)
    if (candidate) setPassage({ candidate, citation })
  }
  const downloadReport = async () => {
    if (!run) return
    setReporting(true); setError('')
    try {
      const report = await createReport(run.runId)
      setReportUrl(report.url)
      const link = document.createElement('a'); link.href = report.url
      if (report.format === 'PDF') link.download = `researchagent-${run.runId}.pdf`
      else { link.target = '_blank'; link.rel = 'noopener' }
      document.body.append(link); link.click(); link.remove()
    } catch { setError('Report generation failed. Your last answer and receipts remain available; try again.') }
    finally { setReporting(false) }
  }
  const retry = async (intentId: string) => {
    if (!run) return
    setError('')
    try { setRun(await retryDelivery(run.runId, intentId)) } catch { setError('Delivery could not be retried. The charge remains recorded; no new purchase was made.') }
  }
  return <Layout header={<><Modes labels={run?.labels} /><FaultDemo run={run} /></>} aside={run ? <><Budget run={run} /><DecisionTable run={run} /><Activity run={run} /><><Ledger run={run} /><Wire run={run} /></></> : <section className="ra-panel"><h2>Evidence procurement</h2><p>LLMs write. A decision model chooses. Code pays within your budget.</p><p>One retrieval pass, a cited answer, and a visible policy for deciding whether more evidence is worth buying.</p><p className="ra-muted">x402-shaped publisher protocol · synthetic corpus · local publishers</p><p>No real funds · simulated SGD or XRPL Testnet</p></section>}>
    <Ask onAsk={sendAsk} busy={sending || active} />
    {error && <p className="ra-error" role="status">{error}</p>}
    {run && <><Answer key={run.runId} run={run} onCitation={openCitation} /><Impact run={run} />
      {run.intents.filter(i => i.status === 'DELIVERY_FAILED').map(intent => <section className="ra-panel" key={intent.intentId}><h2>Delivery failed after payment</h2><p>The receipt is preserved. Retry downloads the same paid source without another settlement.</p><button type="button" className="ra-button" onClick={() => void retry(intent.intentId)}>Retry delivery</button></section>)}
      <ReportButton run={run} onReport={downloadReport} busy={reporting || active} />
      {reportUrl && <a className="ra-text-button" href={reportUrl} target="_blank" rel="noreferrer">Open report</a>}
      <Sources run={run} onOpen={candidate => setPassage({ candidate })} />
    </>}
    {passage && run && <Passage candidate={passage.candidate} content={getAccessibleContent(run, passage.candidate)} citation={passage.citation} onClose={() => setPassage(undefined)} />}
  </Layout>
}
