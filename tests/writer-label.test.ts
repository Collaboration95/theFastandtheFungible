// Gate 5 (labels): the zero-clone MCP writers line names fictional writers as fictional and
// team-authored ones as team-authored. Before v1.1.1 it said "Fixture models and fictional writers"
// even when every cited source was a team-authored explainer (VID-2 note 2).
import { readdirSync, readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { FICTIONAL_WRITERS, FIXTURE_WRITERS_LABEL, TEAM_WRITERS, writersLabel } from '../shared/writer-label.js'

const fake = vi.hoisted(() => ({ run: {} as Record<string, unknown> }))
vi.mock('../sdk/index.js', async importOriginal => ({
  ...await importOriginal<typeof import('../sdk/index.js')>(),
  createClient: () => ({ ask: async () => fake.run, getRun: async () => fake.run, search: async () => ({ hits: [] }) }),
}))

const cite = (slug: string, writer = slug) => ({ resourceId: `${slug}-a`, version: 'v1', spanId: 'p1', writer, url: `http://127.0.0.1:1/w/${slug}/blog/${slug}-a#p-p1` })
const team = cite('team-xrpl-explainers', 'ResearchAgent builders · XRPL explainers (team-authored)')

it('keeps the fictional and team writer lists in step with data/writers', () => {
  const publishers = readdirSync('data/writers').filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(`data/writers/${f}`, 'utf8')).publisher as { slug: string; name: string; synthetic: boolean })
  expect([...FICTIONAL_WRITERS].sort()).toEqual(publishers.filter(p => p.synthetic).map(p => p.slug).sort())
  expect([...TEAM_WRITERS].sort()).toEqual(publishers.filter(p => !p.synthetic).map(p => p.slug).sort())
  for (const p of publishers.filter(p => !p.synthetic)) expect(p.name).toMatch(/team-authored/)
})

it('names the kinds of writer behind the cited passages and purchases', () => {
  expect(writersLabel({})).toBe(FIXTURE_WRITERS_LABEL)
  expect(writersLabel({ citations: [], purchases: [] })).toBe('Fixture models · fictional and team-authored writers')
  expect(writersLabel({ citations: [team, cite('team-builder-notes')] })).toBe('Fixture models · team-authored writers')
  expect(writersLabel({ citations: [cite('load-factor'), cite('open-records')] })).toBe('Fixture models · fictional writers')
  expect(writersLabel({ citations: [team], purchases: [{ writer: 'Load Factor', source: { profileId: 'load-factor' } }] })).toBe('Fixture models · fictional and team-authored writers')
  // A purchase with no slug is still team-authored by its disclosed writer name; an unknown writer is never called fictional.
  expect(writersLabel({ purchases: [{ writer: 'ResearchAgent builders (team-authored) · team-authored · real content' }] })).toBe('Fixture models · team-authored writers')
  expect(writersLabel({ citations: [cite('my-notes', 'My Notes')] })).toBe('Fixture models · unverified writer-supplied writers')
  expect(writersLabel({ citations: [cite('alphaleak'), team, cite('my-notes')] })).toBe('Fixture models · fictional, team-authored and unverified writer-supplied writers')
})

it('MCP results carry the narrowed writers line and keep every other startup label', async () => {
  const { createMcpServer } = await import('../mcp/tools.js')
  const startup = ['SIMULATED fallback · faucet_unavailable · no ledger transactions', FIXTURE_WRITERS_LABEL]
  const server = createMcpServer({ apiUrl: 'http://127.0.0.1:1', labels: startup })
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'writer-label', version: '1' })
  await server.connect(a); await client.connect(b)
  const call = async (name: string, args: Record<string, unknown>) => JSON.parse(((await client.callTool({ name, arguments: args })).content as { text: string }[])[0].text)
  try {
    const run = (citations: unknown[]) => ({ run_id: '00000000-0000-4000-8000-000000000001', phase: 'RUNNING', citations, purchases: [] })
    fake.run = run([team])
    expect((await call('ask_expert', { question: 'How does the writer get paid?', budget_sgd: 2 })).startupLabels).toEqual([startup[0], 'Fixture models · team-authored writers'])
    fake.run = run([cite('load-factor')])
    expect((await call('get_run', { run_id: '00000000-0000-4000-8000-000000000001' })).startupLabels).toEqual([startup[0], 'Fixture models · fictional writers'])
    expect((await call('search_expertise', { query: 'escrow' })).startupLabels).toEqual(startup)
  } finally { await client.close(); await server.close() }
})
