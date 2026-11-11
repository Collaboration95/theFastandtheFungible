// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { EVENT_LABELS, FALLBACK_LABELS, REASON_LABELS, eventPresentation, searchLabel } from '../shared/trace-labels'
import { IntentStatusSchema, RunPhaseSchema, STOP_REASONS, TRACE_EVENT_TYPES, type TraceEvent } from '../shared/contracts'
import type { FactCover } from '../shared/contracts/manifest'
import Activity from '../src/components/Activity'
import ShowWork from '../src/components/ShowWork'
import Verification from '../src/components/Verification'
import { ucRuns } from '../src/fixtures/run'

const event = (type: string, label = type, data?: TraceEvent['data']): TraceEvent => ({ id: 99, runId: ucRuns.UC1.runId, at: '2026-11-12T00:00:00Z', type, label, data })
const runWith = (...events: TraceEvent[]) => ({ ...structuredClone(ucRuns.UC1), events })
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('maps every production event literal, including phase events and older trace types', () => {
  const types = new Set<string>([...TRACE_EVENT_TYPES, ...RunPhaseSchema.options, 'MODEL_USAGE', 'MODEL_FALLBACK'])
  for (const root of ['server', 'publisher', 'packages']) {
    for (const file of readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.ts')) continue
      const code = readFileSync(join(file.parentPath, file.name), 'utf8')
      for (const match of code.matchAll(/(?:type:\s*|trace\(runId,\s*)'([A-Z_]{2,})'/g)) types.add(match[1])
    }
  }
  for (const type of types) expect(EVENT_LABELS[type], type).toBeTruthy()
})

for (const type of Object.keys(EVENT_LABELS)) it(`renders event ${type} without its code`, () => {
  const { container } = render(<Activity run={runWith(event(type))} />)
  expect(container.textContent).not.toContain(type)
  expect(container.textContent).not.toMatch(/\b\w+_\w+\b/)
  expect(container.querySelector('.ra-tag')?.textContent).toBe(EVENT_LABELS[type])
})

for (const code of Object.keys(REASON_LABELS)) it(`renders reason ${code} in plain words`, () => {
  const { container } = render(<Activity run={runWith(event('TRACE', code))} />)
  expect(container.textContent).not.toContain(code)
  expect(container.textContent).not.toMatch(/\b\w+_\w+\b/)
})

it('covers every purchase status and stop reason', () => {
  for (const code of [...IntentStatusSchema.options, ...STOP_REASONS]) expect(REASON_LABELS[code], code).toBeTruthy()
})

for (const reason of Object.keys(FALLBACK_LABELS)) it(`labels the ${reason} substitution truthfully`, () => {
  const { container } = render(<Activity run={runWith(event('MODEL_FALLBACK', `LLM fallback (${reason}) · labelled fixture`, { reason }))} />)
  expect(container.textContent).toContain(FALLBACK_LABELS[reason])
  expect(container.textContent).toContain('offline extracts')
  expect(container.textContent).not.toMatch(/MODEL_FALLBACK|LLM fallback|\(guard\)|\b\w+_\w+\b/)
  expect(container.querySelectorAll('.is-warning')).toHaveLength(['guard', 'cap'].includes(reason) ? 0 : 1)
})

it('keeps healthy fixture rows neutral and actual failures visible', () => {
  const run = structuredClone(ucRuns.UC1)
  run.events.push(event('MODEL_FALLBACK', 'LLM fallback (guard) · labelled fixture'))
  const before = JSON.stringify(run)
  const { container, unmount } = render(<Activity run={run} />)
  expect(container.querySelectorAll('.is-warning')).toHaveLength(0)
  expect(container.textContent).toContain('without calling the model')
  expect(container.textContent).toContain('Keyword search (semantic search not used)')
  expect(JSON.stringify(run)).toBe(before)
  unmount()
  render(<Activity run={{ ...runWith(event('FAILED', 'Article delivery failed.')), phase: 'FAILED', error: 'Article delivery failed.' }} />)
  expect(screen.getByRole('alert').textContent).toContain('failed')
  expect(document.querySelectorAll('.is-warning')).toHaveLength(1)
})

it('keeps a healthy paid fixture neutral, preserves network disclosures, and treats HTTP 402 as payment terms', () => {
  const { container } = render(<Activity run={ucRuns.UC2} />)
  expect(container.querySelectorAll('.is-warning')).toHaveLength(0)
  expect(eventPresentation(event('XRPL', 'XRPL Testnet · SIMULATED · no real funds')).detail).toBe('XRPL Testnet · SIMULATED · no real funds')
  expect(eventPresentation(event('WIRE', 'Payment terms', { status: 402 })).warning).toBe(false)
  expect(eventPresentation(event('WIRE', 'Request failed', { status: 503 })).warning).toBe(true)
})

it('does not turn unknown substitutions or explicit failed proof/search events into success', () => {
  for (const e of [event('MODEL_FALLBACK', 'LLM fallback'), event('PROOF', 'Check failed', { ok: false }), event('FOLLOW_UP', 'Search failed', { failed: true }), event('SEARCH', 'Some writers unavailable', { unavailable: ['writer'] })]) expect(eventPresentation(e).warning).toBe(true)
  expect(eventPresentation(event('MODEL_FALLBACK')).detail).toContain('reason was not recorded')
  expect(eventPresentation(event('FUTURE_EVENT', 'new_reason')).detail).toBe('new reason')
})

it('uses the same search label in Models without inferring an outage from keyword mode', () => {
  const run = runWith(event('MODEL_FALLBACK', 'LLM fallback (guard)'))
  render(<ShowWork run={run} configured={{ ...run.labels, research: 'deepseek', plan: 'fixture' }} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Models' }))
  expect(screen.getByRole('tabpanel').textContent).toContain(searchLabel(run.labels.search!))
  expect(screen.getByRole('tabpanel').textContent).not.toContain('embeddings unavailable')
  expect(document.querySelector('.ra-models .is-fallback')?.textContent).not.toContain('Research')
})

describe('all team fact menus render as promises rather than bare catalogue pairs', () => {
  const articles = readdirSync('data/corpus/v2/articles', { recursive: true, withFileTypes: true }).filter(file => file.isFile() && file.name.endsWith('.json') && file.parentPath.split('/').at(-1)!.startsWith('team-'))
  it('has only the shared promise renderer in the UI', () => {
    for (const file of readdirSync('src/components', { recursive: true, withFileTypes: true })) {
      if (file.isFile() && file.name.endsWith('.tsx')) expect(readFileSync(join(file.parentPath, file.name), 'utf8')).not.toMatch(/factMenu|covers\.(entity|measure)/)
    }
  })
  for (const file of articles) it(file.name, () => {
    const article = JSON.parse(readFileSync(join(file.parentPath, file.name), 'utf8')) as { factMenu?: Record<string, FactCover> }
    for (const [id, covers] of Object.entries(article.factMenu ?? {})) {
      const run = structuredClone(ucRuns.UC2), intent = run.intents[0]
      const candidate = run.candidates.find(c => c.resourceId === intent.resourceId)!
      candidate.manifest!.claims = [{ id, kind: 'named-source', leaf: '0'.repeat(64), covers }]
      intent.status = 'VERIFIED'
      const { container, unmount } = render(<Verification run={run} intent={intent} />)
      const text = container.querySelector('li span')?.textContent
      expect(text).toMatch(/Mentions /)
      expect(text?.trim()).not.toBe(`${covers.entity} ${covers.measure}`)
      unmount()
    }
  })
})
