import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Mark } from '../format'

/** One exchange: the user's message, then the reply once it arrives (none while waiting, or while a plan card is open). */
export interface ChatMessage { id: number; question: string; reply?: string; label?: string; error?: string }
export interface ChatThreadProps {
  messages: ChatMessage[]
  onSend: (question: string) => void | Promise<void>
  /** Waiting for a reply, or a plan card is open: the box stays typable but cannot send. */
  busy?: boolean
  /** Clarify chips or the plan card when a follow-up turns out to need research. */
  above?: ReactNode
}
/**
 * The chat page (owner, 9 Oct): a question that needs no research opens a plain conversation, with no budget,
 * no suggested questions and no hero. Replies carry no citations, so each says so (gate 5). Text only; never HTML.
 */
export default function ChatThread({ messages, onSend, busy = false, above }: ChatThreadProps) {
  const id = useId()
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const last = messages.at(-1)
  // Follow the newest message, and keep the cursor in the box.
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' }) }, [messages.length, last?.reply, last?.error, above])
  useEffect(() => { box.current?.focus() }, [])
  const send = () => {
    const question = text.trim()
    if (!question || busy) return
    setText('')
    void onSend(question)
  }
  return <main className="ra-chatpage" aria-label="Chat">
    <div className="ra-thread" role="log" aria-live="polite" aria-label="Conversation">
      {messages.map(message => <div key={message.id} className="ra-turn">
        <p className="ra-msg-user">{message.question}</p>
        {message.reply !== undefined ? <div className="ra-msg-bot" data-testid="ra-chat-reply">
          <span className="ra-msg-avatar" aria-hidden="true"><Mark /></span>
          <div className="ra-msg-body">
            {message.reply.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean).map((part, index) => <p key={index}>{part}</p>)}
            <p className="ra-msg-meta">{message.label ?? 'model'} · no sources searched · nothing bought</p>
          </div>
        </div>
          : message.error ? <p className="ra-msg-err" role="alert">{message.error}</p>
          : message === last && busy && !above ? <div className="ra-msg-bot" aria-label="Writing a reply"><span className="ra-msg-avatar" aria-hidden="true"><Mark /></span><span className="ra-typing" aria-hidden="true"><i /><i /><i /></span></div>
          : null}
      </div>)}
      <div ref={end} />
    </div>
    <div className="ra-chat-dock">
      {above}
      <form className="ra-chat-box" onSubmit={event => { event.preventDefault(); send() }}>
        <label className="ra-sr" htmlFor={`${id}-m`}>Your message</label>
        <textarea ref={box} id={`${id}-m`} value={text} onChange={event => setText(event.target.value)} maxLength={2000} rows={1} placeholder="Message ResearchAgent…"
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } }} />
        <button type="submit" className="ra-chat-send" aria-label="Send" disabled={busy || !text.trim()}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V4M4.5 9.5 10 4l5.5 5.5" /></svg>
        </button>
      </form>
      <p className="ra-chat-note">Questions about markets and companies are researched with your budget from Home.</p>
    </div>
  </main>
}
