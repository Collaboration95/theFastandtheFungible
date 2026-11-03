import { useEffect } from 'react'
import type { Scope } from '../../shared/contracts/index.js'

export interface ClarifyChipsProps {
  questions: Scope['questions']
  answers: Record<string, string>
  onAnswer: (id: string, option: string) => void
  onSkip: () => void
}
/** Clarify (D8): at most two short questions as option chips. They wait for the user; nothing expires here. */
export default function ClarifyChips({ questions, answers, onAnswer, onSkip }: ClarifyChipsProps) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { const question = questions.find(q => !answers[q.id]); const index = Number(e.key) - 1; if (question && index >= 0 && index < question.options.length) { e.preventDefault(); onAnswer(question.id, question.options[index]) } else if (e.key === 'Backspace') { e.preventDefault(); onSkip() } }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [questions, answers, onAnswer, onSkip])
  return <section className="ra-clarify" aria-label="Clarifying questions">
    {questions.map(question => <div key={question.id} className="ra-clarify-q" role="group" aria-label={question.text}>
      <p>Which angle matters most?</p>
      <div className="ra-clarify-opts">{question.options.map((option, index) => <button key={option} type="button" className={`ra-chip-opt${answers[question.id] === option ? ' is-on' : ''}`} aria-pressed={answers[question.id] === option} onClick={() => onAnswer(question.id, option)} aria-label={option}><span aria-hidden="true">{index + 1}</span> {option}</button>)}</div>
    </div>)}
    <button type="button" className="ra-link" onClick={onSkip}>Skip</button>
  </section>
}
