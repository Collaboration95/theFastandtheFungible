export interface ChatReplyProps {
  question: string
  reply: string
  /** The model that wrote the reply (or the fixture label), as the server reports it. */
  label?: string
  onDismiss: () => void
}
/** A question that needs no research gets a plain reply here, above the input bar: no plan card, no run, nothing bought.
    It carries no citations, so it says so (gate 5). Text only; never HTML. */
export default function ChatReply({ question, reply, label, onDismiss }: ChatReplyProps) {
  return <section className="ra-chat" data-testid="ra-chat" role="status" aria-live="polite" aria-label="Direct reply">
    <p className="ra-chat-q">{question}</p>
    <div className="ra-chat-a">{reply.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean).map((part, index) => <p key={index}>{part}</p>)}</div>
    <p className="ra-chat-meta">Direct reply · {label ?? 'model'} · no sources searched · nothing bought</p>
    <button type="button" className="ra-chat-x" aria-label="Dismiss reply" onClick={onDismiss}>×</button>
  </section>
}
