// Proof of refusal routes. Owner side: GET/POST /api/runs/:id/proof (hosted: the gateway has already proven the run is
// the caller's). Public side: GET /proof/:id (page), /proof/:id/receipts.json and /proof/:id/card.html, read-only and
// served from the stored snapshot only. Hosted rate limits and the "no session for a public read" rule live in
// server/hosted/session.ts; nothing here reads a run for a public request.
import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import type { ApiContext } from './context.js'
import { refusalEligibility, PROOF_ID } from '../../shared/refusal-proof.js'
import { ProofError, RefusalProofs } from '../refusal-proof.js'
import { proofCsp, renderProofMissing, renderProofPage } from '../proof-page.js'

export function refusalProofRouter(context: ApiContext, options: { hosted: boolean; origin?: string }) {
  const router = Router(), { store } = context
  const proofs = new RefusalProofs(store)
  const principalOf = (res: { locals: Record<string, unknown> }, runId: string) => (res.locals.hostedSession as { principal?: string } | undefined)?.principal ?? store.runPrincipal(runId)?.principal ?? ''
  const origin = options.origin?.replace(/\/$/, '')
  const publicHtml = (res: import('express').Response, status: number, html: (nonce: string) => string) => {
    const nonce = randomBytes(16).toString('base64')
    res.status(status).set({ 'Content-Security-Policy': proofCsp(nonce), 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' }).type('html').send(html(nonce))
  }
  const found = (id: string) => (PROOF_ID.test(id) ? proofs.get(id) : undefined)

  router.get('/api/runs/:id/proof', (req, res) => {
    const runId = String(req.params.id)
    let run
    try { run = store.getRun(runId) } catch { res.status(404).json({ error: 'Run not found.' }); return }
    const proof = proofs.forRun(runId)
    const eligibility = refusalEligibility(run)
    res.json({ eligible: eligibility.ok, ...(eligibility.ok ? {} : { code: eligibility.code, message: eligibility.message }), ...(proof ? { proof: { id: proof.id, path: `/proof/${proof.id}`, createdAt: proof.createdAt } } : {}) })
  })
  router.post('/api/runs/:id/proof', async (req, res) => {
    const runId = String(req.params.id)
    try {
      const { proof, created } = await proofs.create(runId, { hosted: options.hosted, principal: principalOf(res, runId) })
      res.status(created ? 201 : 200).json({ proof: { id: proof.id, path: `/proof/${proof.id}`, createdAt: proof.createdAt } })
    } catch (error) {
      if (!(error instanceof ProofError)) throw error
      res.status(error.status).json({ error: error.code, message: error.message })
    }
  })

  router.get('/proof/:id', (req, res) => {
    const proof = found(String(req.params.id))
    if (!proof) { publicHtml(res, 404, nonce => renderProofMissing(nonce)); return }
    publicHtml(res, 200, nonce => renderProofPage(proof.snapshot, { mode: 'page', origin, nonce }))
  })
  router.get('/proof/:id/receipts.json', (req, res) => {
    const proof = found(String(req.params.id))
    if (!proof) { res.status(404).json({ error: 'Not found.' }); return }
    res.type('json').send(JSON.stringify(proof.snapshot.bundle))
  })
  router.get('/proof/:id/card.html', (req, res) => {
    const proof = found(String(req.params.id))
    if (!proof) { res.status(404).json({ error: 'Not found.' }); return }
    res.set({ 'Content-Disposition': `attachment; filename="proof-of-refusal-${proof.id.slice(0, 8)}.html"`, 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'", 'Referrer-Policy': 'no-referrer' })
      .type('html').send(renderProofPage(proof.snapshot, { mode: 'card', origin }))
  })
  return { router, proofs }
}
