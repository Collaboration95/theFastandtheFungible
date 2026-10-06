// The story-bible use cases (D16) as scenario fixtures: the question, the clarify answers the
// demo gives, and the expected picks. Exported for the scenario tests and presenter tooling (#154).
// data/corpus/v2/story-bible.json is the single source; nothing here restates its wording.
import { readFileSync } from 'node:fs'

type Bible = { useCases: { id: string; question: string; clarify: { question: string; options: string[]; expectedUserPick: string } | null; expectedPicks: { round1: string | null; round2: string | null; skippedRewrite: string; afterChallenge?: { refund: string; honestyBefore: number; honestyAfter: number; status: string } } }[] }
const bible = JSON.parse(readFileSync(new URL('../../data/corpus/v2/story-bible.json', import.meta.url), 'utf8')) as Bible

export type UseCaseId = 'UC1' | 'UC2' | 'UC3'
export type UseCase = {
  id: UseCaseId
  question: string
  /** The clarify question the scope step must ask (UC2 only), and the option the demo picks. */
  clarify?: { text: string; options: string[]; pick: string }
  /** POST /runs `answers` for this use case (keyed like the scope step's question id). */
  answers?: Record<string, string>
  expected: { round1: string | null; round2: string | null; skippedRewrite: string; refund?: { articleId: string; honestyBefore: number; honestyAfter: number; status: string } }
}

export const USE_CASES: Record<UseCaseId, UseCase> = Object.fromEntries(bible.useCases.map(u => [u.id, {
  id: u.id as UseCaseId, question: u.question,
  ...(u.clarify ? { clarify: { text: u.clarify.question, options: u.clarify.options, pick: u.clarify.expectedUserPick }, answers: { angle: u.clarify.expectedUserPick } } : {}),
  expected: {
    round1: u.expectedPicks.round1, round2: u.expectedPicks.round2, skippedRewrite: u.expectedPicks.skippedRewrite,
    ...(u.expectedPicks.afterChallenge ? { refund: { articleId: u.expectedPicks.afterChallenge.refund, honestyBefore: u.expectedPicks.afterChallenge.honestyBefore, honestyAfter: u.expectedPicks.afterChallenge.honestyAfter, status: u.expectedPicks.afterChallenge.status } } : {}),
  },
}])) as Record<UseCaseId, UseCase>

/** The POST /runs body for a use case. */
export const askBody = (id: UseCaseId, budgetMinor = 200) => ({ question: USE_CASES[id].question, budgetMinor, ...(USE_CASES[id].answers ? { answers: USE_CASES[id].answers } : {}) })
