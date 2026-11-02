import { Router } from 'express'
import type { ApiContext } from './context.js'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { startActiveObservation } from '@langfuse/tracing'
import { buildReport, renderReport } from '../agents/report.js'
import { isLlmConfigured } from '../agents/llm.js'
import { scoreTrace, traceRun } from '../telemetry.js'

export function reportsRouter(context: ApiContext) {
  const router = Router()
  const { store, reportDir, reportJobs, progress } = context
  router.post('/runs/:id/report', async (req, res) => {
    const runId = String(req.params.id)
    const run = store.getRun(runId)
    if (!run.answers.length) return res.status(409).json({ error: 'Wait for a validated answer before requesting a report.' })
    let job = reportJobs.get(runId)
    if (!job) {
      store.updateRun(runId, { reportStatus: 'GENERATING' })
      store.appendEvent(runId, { type: 'REPORT', label: 'Rendering a cited report with persisted decisions and receipts.' })
      const done = progress(runId, 'Report generation is in progress; validated passages and receipts are preserved.')
      let rendered: { format: string; findings: number; provider: string } | undefined
      const render = () => buildReport(run).then(report => startActiveObservation('render-report', async observation => {
        const result = await renderReport(report, resolve(reportDir, `${runId}.pdf`))
        rendered = { format: result.format, findings: report.findings.length, provider: report.provider }
        observation.update({ output: rendered })
        return result
      }))
      const scoreReport = () => {
        if (!rendered) return
        scoreTrace('report-format', rendered.format)
        if (isLlmConfigured()) scoreTrace('report-fallback', rendered.provider === 'fixture')
      }
      // A separate trace in the run's session: the draft-report generation plus PDF rendering.
      job = traceRun('research-report', run, render, () => rendered ?? { format: 'FAILED' }, scoreReport).then(result => {
        store.updateRun(runId, { reportStatus: result.format })
        store.appendEvent(runId, { type: 'REPORT', label: result.format === 'PDF' ? 'PDF report ready.' : 'Chromium unavailable; HTML print fallback ready.' })
        return result
      }).catch(error => { store.updateRun(runId, { reportStatus: 'FAILED' }); throw error }).finally(() => { done(); reportJobs.delete(runId) })
      reportJobs.set(runId, job)
    }
    const result = await job
    res.json({ format: result.format, url: `/runs/${runId}/report.${result.format.toLowerCase()}` })
  })
  for (const extension of ['pdf', 'html']) router.get(`/runs/:id/report.${extension}`, (req, res) => {
    const runId = String(req.params.id)
    store.getRun(runId)
    const path = resolve(reportDir, `${runId}.${extension}`)
    if (!existsSync(path)) return res.status(404).json({ error: 'Create the report first.' })
    res.type(extension === 'pdf' ? 'application/pdf' : 'text/html').sendFile(path, { dotfiles: 'allow' })
  })
  return router
}
