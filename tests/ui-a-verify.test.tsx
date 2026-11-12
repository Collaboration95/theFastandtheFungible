// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import VerifyInBrowser from '../src/components/hosted/VerifyInBrowser'
const bundle = JSON.parse(readFileSync('public/judge/hosted-run-nov11.receipts.json', 'utf8'))
vi.mock('../src/verify/browser', () => ({ verifyInBrowser: async () => ({ ok: true, testnet: true, checks: [{ check: 'citation test', status: 'PASS', detail: 'fixture check' }], groups: [], endpoint: 'recorded fixture', at: '' }) }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('finishes with the five gates open and keeps every verbatim admission label and audit ID under Technical details', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => bundle })))
  const { container } = render(<VerifyInBrowser bundleUrl="/judge/hosted-run-nov11.receipts.json" />)
  fireEvent.click(screen.getByRole('button', { name: 'Run the checks' }))
  await screen.findByText('All 1 checks passed')
  expect(container.querySelector<HTMLDetailsElement>('.ra-gates')?.open).toBe(true)
  expect(container.querySelector('.ra-gates')?.textContent).not.toMatch(/Held|Broken/)
  const rows = [...container.querySelectorAll('.ra-gates > ul > li')]
  expect(rows).toHaveLength(5)
  for (const row of rows) expect(row.querySelector<HTMLDetailsElement>('details')?.open).toBe(false)
  const labels = bundle.audit.entries.filter((e: { kind: string }) => e.kind === 'admission').flatMap((e: { data: { labels: Record<string, string> } }) => Object.entries(e.data.labels))
  const technical = rows[4].querySelector('details')!
  expect(within(technical).getByText('Technical details')).toBeTruthy()
  for (const [name, value] of labels) expect(technical.textContent).toContain(`${name}: ${value}`)
  expect(technical.textContent).toMatch(/Audit #\d+/)
})
