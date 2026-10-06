import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { DEMO_QUESTIONS } from '../shared/contracts/examples.js'
import { ScopeSchema } from '../shared/contracts/index.js'
import { ANGLE_QUESTION, SCOPE_FEW_SHOT, SCOPE_PROMPT, fixtureScope, scope } from '../server/agents/scope.js'
import { createApiApp } from '../server/routes.js'

const bible = JSON.parse(readFileSync('data/corpus/v2/story-bible.json', 'utf8')) as { useCases: { id: string; clarify: null | { question: string; options: string[]; fewShot: { user: string; assistant: { questions: { text: string; options: string[] }[] } }[] } }[] }
const uc = (id: string) => DEMO_QUESTIONS.find(q => q.id === id)!.text
const uc2 = bible.useCases.find(u => u.id === 'UC2')!.clarify!
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
const llm = (value: unknown) => {
  vi.stubEnv('LLM_PROVIDER', 'deepseek'); vi.stubEnv('DEEPSEEK_API_KEY', 'test-only')
  const frames = `data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(value) } }] })}\n\ndata: [DONE]\n\n`
  vi.stubGlobal('fetch', vi.fn(async () => new Response(frames)))
}

describe('scope step (#136)', () => {
  it('fixture: UC2 gets exactly the story-bible angle question; UC1 and UC3 get none', () => {
    const scoped = fixtureScope(uc('UC2'))
    expect(scoped.questions).toHaveLength(1)
    expect(scoped.questions[0]).toMatchObject({ text: uc2.question, options: uc2.options })
    expect(fixtureScope(uc('UC1')).questions).toEqual([])
    expect(fixtureScope(uc('UC3')).questions).toEqual([])
    for (const q of DEMO_QUESTIONS) expect(ScopeSchema.safeParse(fixtureScope(q.text)).success).toBe(true)
  })
  it('generic rule: an unnamed bond market is ambiguous on market and timeframe (≤ 2 questions, 2–4 options)', () => {
    const { questions } = fixtureScope('What happened to the bond market?')
    expect(questions.map(q => q.text)).toEqual(['Which market?', 'Timeframe?'])
    expect(fixtureScope('What happened to the JGB bond market?').questions).toEqual([])
  })
  it('the few-shot mirrors the story bible, and the prompt is snapshot-tested', () => {
    expect(SCOPE_FEW_SHOT.slice(0, 3).map(e => e.user)).toEqual(uc2.fewShot.map(e => e.user))
    expect(SCOPE_FEW_SHOT.slice(0, 3).map(e => e.assistant.questions.map(q => ({ text: q.text, options: q.options })))).toEqual(uc2.fewShot.map(e => e.assistant.questions))
    expect(ANGLE_QUESTION.options).toEqual(uc2.options)
    expect(SCOPE_PROMPT).toMatchSnapshot()
  })
  it('clarify=never skips the questions; the label says fixture', async () => {
    expect(await scope(uc('UC2'), { clarify: 'never' })).toMatchObject({ questions: [], label: 'fixture · scope-fixture' })
  })
  it('uses the model when valid, and falls back to the fixture when it mentions spending', async () => {
    llm({ questions: [], plan: { restatement: 'BoJ change', subqueries: ['BoJ policy statement'] } })
    expect(await scope(uc('UC1'))).toMatchObject({ questions: [], plan: { subqueries: ['BoJ policy statement'] }, label: 'DeepSeek · deepseek-flash' })
    llm({ questions: [{ id: 'b', text: 'How much budget should I spend?', options: ['S$1', 'S$2'] }], plan: { restatement: 'x', subqueries: ['x'] } })
    expect(await scope(uc('UC1'))).toMatchObject({ questions: [], label: 'fixture · scope-fixture' })
  })
  it('POST /api/scope answers with questions and a plan, and honours ?clarify=never', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scope-test-'))
    const api = await createApiApp({ dbPath: join(dir, 'api.db'), publisherUrl: 'http://127.0.0.1:9', reportDir: join(dir, 'reports') })
    const server = api.app.listen(0, '127.0.0.1')
    await new Promise(done => server.once('listening', done))
    try {
      const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
      const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
      const scoped = await post('/api/scope', { question: uc('UC2') })
      expect(scoped.questions[0].options).toEqual(uc2.options)
      expect(scoped.plan.subqueries.length).toBeGreaterThan(0)
      expect((await post('/api/scope?clarify=never', { question: uc('UC2') })).questions).toEqual([])
      expect((await post('/api/scope', { question: uc('UC2'), clarify: 'never' })).questions).toEqual([])
    } finally { server.close(); api.close(); rmSync(dir, { recursive: true, force: true }) }
  })
})
