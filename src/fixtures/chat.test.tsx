// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { exampleRun, paidStoryRun, uc2Scope } from './run.js'
import App from '../App.js'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); try { localStorage.clear() } catch { /* no storage */ } })

/** Stub the browser; `/api/scope` answers each question from `replies` with a chat reply, anything else with a normal scope. */
function stub(replies: Record<string, string>) {
  const calls: { path: string; body?: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ path, body })
    const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data })
    if (path === '/api/health') return json({ status: 'ok', labels: exampleRun.labels, faults: false })
    if (path === '/api/scope') { const reply = replies[String(body?.question)]; return json({ ...uc2Scope, questions: [], label: 'fixture · scope-fixture', ...(reply ? { chat: { reply } } : {}) }) }
    if (path === '/runs') return json({ ...paidStoryRun, question: body?.question }, 201)
    return json({}, 404)
  }))
  vi.stubGlobal('EventSource', class extends EventTarget { close() {} })
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  return calls
}
const ask = (text: string) => {
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: /^Ask/ }))
}
const message = (text: string) => {
  fireEvent.change(screen.getByLabelText('Your message'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
}

describe('chat page (owner, 9 Oct)', () => {
  it('a chat question opens the chat page: the reply with its no-sources label, no hero, presets or budget, no run', async () => {
    const calls = stub({ 'What are you?': 'I am ResearchAgent.\n\nI search writers for you.' })
    render(<App />)
    ask('What are you?')
    const reply = await screen.findByTestId('ra-chat-reply')
    expect(screen.getByRole('log', { name: 'Conversation' }).textContent).toContain('What are you?')
    expect(reply.querySelectorAll('p')).toHaveLength(3)
    expect(reply.textContent).toContain('I search writers for you.')
    expect(reply.textContent).toContain('fixture · scope-fixture · no sources searched · nothing bought')
    // Home is gone: no hero, no suggested questions, no budget, no plan card.
    expect(screen.queryByRole('heading', { name: /Give it a budget/ })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Demo questions' })).toBeNull()
    expect(screen.queryByLabelText('Your question')).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Search plan' })).toBeNull()
    expect(calls.some(call => call.path === '/runs')).toBe(false)
  })

  it('a chat follow-up joins the thread', async () => {
    stub({ hi: 'Hello!', 'How big is the Sun?': 'About 1.39 million km across.' })
    render(<App />)
    ask('hi')
    await screen.findByTestId('ra-chat-reply')
    message('How big is the Sun?')
    expect(await screen.findByText('About 1.39 million km across.')).toBeTruthy()
    expect(screen.getAllByTestId('ra-chat-reply')).toHaveLength(2)
    expect((screen.getByLabelText('Your message') as HTMLTextAreaElement).value).toBe('')
  })

  it('a research follow-up opens the plan card on the chat page; Cancel drops it and starts nothing', async () => {
    const calls = stub({ hi: 'Hello!' })
    render(<App />)
    ask('hi')
    await screen.findByTestId('ra-chat-reply')
    message('Kestrel outlook?')
    await screen.findByRole('dialog', { name: 'Search plan' })
    expect(screen.getByRole('log', { name: 'Conversation' }).textContent).toContain('Kestrel outlook?')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Search plan' })).toBeNull()
    expect(screen.getByRole('log', { name: 'Conversation' }).textContent).not.toContain('Kestrel outlook?')
    expect(calls.some(call => call.path === '/runs')).toBe(false)
  })

  it('Go on that plan card starts the run with the Home budget', async () => {
    const calls = stub({ hi: 'Hello!' })
    render(<App />)
    ask('hi')
    await screen.findByTestId('ra-chat-reply')
    message('Kestrel outlook?')
    await screen.findByRole('dialog', { name: 'Search plan' })
    fireEvent.click(screen.getByRole('button', { name: 'Go now' }))
    await screen.findByRole('heading', { name: 'Kestrel outlook?' })
    expect(calls.find(call => call.path === '/runs')?.body).toMatchObject({ question: 'Kestrel outlook?', budgetMinor: 200 })
  })

  it('a research question on Home still shows the plan card there; New question leaves the chat page', async () => {
    const calls = stub({ hi: 'Hello!' })
    render(<App />)
    ask('Kestrel outlook?')
    await screen.findByRole('dialog', { name: 'Search plan' })
    expect(screen.queryByRole('log', { name: 'Conversation' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    ask('hi')
    await screen.findByTestId('ra-chat-reply')
    fireEvent.click(screen.getByRole('button', { name: /New question/ }))
    expect(screen.getByLabelText('Your question')).toBeTruthy()
    expect(screen.queryByRole('log', { name: 'Conversation' })).toBeNull()
    expect(calls.some(call => call.path === '/runs')).toBe(false)
  })
})
