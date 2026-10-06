import type { Scope } from '../../shared/contracts/index.js'

export interface ClarifyChipsProps {
  questions: Scope['questions']
  answers: Record<string, string>
  onAnswer: (id: string, option: string) => void
  onSkip: () => void
}
/** Clarify (D8): at most two short questions as option chips. They wait for the user; nothing expires here. */
export default function ClarifyChips({ questions, answers, onAnswer, onSkip }: ClarifyChipsProps) {
  return <section className="ra-clarify" aria-label="Clarifying questions">
    {questions.map(question => <div key={question.id} className="ra-clarify-q" role="group" aria-label={question.text}>
      <p>{question.text}</p>
      <div className="ra-clarify-opts">{question.options.map(option => <button key={option} type="button" className={`ra-chip-opt${answers[question.id] === option ? ' is-on' : ''}`} aria-pressed={answers[question.id] === option} onClick={() => onAnswer(question.id, option)}>{option}</button>)}</div>
    </div>)}
    <button type="button" className="ra-link" onClick={onSkip}>Skip</button>
  </section>
}
