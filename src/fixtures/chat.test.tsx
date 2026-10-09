// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { exampleRun, paidStoryRun, uc2Scope } from './run.js'
import App from '../App.js'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); try { localStorage.clear() } catch { /* no storage */ } })

/** Stub the browser; `/api/scope` answers with `chat` when given, else a normal scope. */
function stub(chat?: { reply: string }) {
  const calls: { path: string; body?: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ path, body })
    const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data })
    if (path === '/api/health') return json({ status: 'ok', labels: exampleRun.labels, faults: false })
    if (path === '/api/scope') return json({ ...uc2Scope, questions: [], label: 'fixture · scope-fixture', ...(chat ? { chat } : {}) })
    if (path === '/runs') return json({ ...paidStoryRun, question: body?.question }, 201)
    return json({}, 404)
  }))
  vi.stubGlobal('EventSource', class extends EventTarget { close() {} })
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  return calls
}
const ask = (text: string) => {
  const box = screen.getByLabelText('Your question') as HTMLTextAreaElement
  fireEvent.change(box, { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: /^Ask/ }))
  return box
}

describe('direct chat reply', () => {
  it('shows the reply with its no-sources label and starts nothing', async () => {
    const calls = stub({ reply: 'I am ResearchAgent.\n\nI search writers for you.' })
    render(<App />)
    const box = ask('What are you?')
    const card = await screen.findByTestId('ra-chat')
    expect(card.textContent).toContain('What are you?')
    expect(card.textContent).toContain('I am ResearchAgent.')
    expect(card.textContent).toContain('I search writers for you.')
    expect(card.textContent).toContain('no sources searched')
    expect(card.textContent).toContain('fixture · scope-fixture')
    expect(card.querySelectorAll('.ra-chat-a p')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Go now' })).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Search plan' })).toBeNull()
    expect(screen.queryByRole('group', { name: /Which angle/ })).toBeNull()
    expect(calls.some(call => call.path === '/runs')).toBe(false)
    // The box is empty and ready for the next question.
    expect(box.value).toBe('')
    expect((box as HTMLTextAreaElement).disabled).toBe(false)
    // Dismiss removes it.
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss reply' }))
    expect(screen.queryByTestId('ra-chat')).toBeNull()
  })

  it('a normal scope still shows the action modal', async () => {
    const calls = stub()
    render(<App />)
    ask('Kestrel outlook?')
    await screen.findByRole('dialog', { name: 'Search plan' })
    expect(screen.getByRole('button', { name: 'Go now' })).toBeTruthy()
    expect(screen.queryByTestId('ra-chat')).toBeNull()
    expect(calls.some(call => call.path === '/runs')).toBe(false)
  })

  it('a new ask clears the previous reply', async () => {
    stub({ reply: 'Hello!' })
    render(<App />)
    ask('hi')
    await screen.findByTestId('ra-chat')
    ask('How big is the Sun?')
    expect((await screen.findByTestId('ra-chat')).textContent).toContain('How big is the Sun?')
    expect(screen.getAllByTestId('ra-chat')).toHaveLength(1)
  })
})
