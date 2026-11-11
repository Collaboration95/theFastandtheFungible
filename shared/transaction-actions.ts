import { identifiersIn, isCamelCaseName, memoByText } from './relevance.js'

/**
 * QUAL: the family member a verb asks for. "Which transaction type creates or modifies a permissioned domain?" asks for
 * the Set member (PermissionedDomainSet), never Delete; "What transactions release or return an XRPL escrow?" asks for
 * Finish and Cancel, never Create. Verb stems map to the last word of a transaction name (EscrowFinish → finish).
 */
const ACTION_MEMBERS: readonly [RegExp, readonly string[]][] = [
  [/\b(?:creat|establish|register)\w*|\bissu(?:e|es|ed|ing)\b|\bplac(?:e|es|ing)\b/gi, ['create', 'set']],
  [/\b(?:modif|updat|chang|edit|configur|publish)\w*/gi, ['set']],
  [/\b(?:delet|remov|destroy)\w*/gi, ['delete']],
  [/\b(?:releas|finish)\w*/gi, ['finish']],
  [/\b(?:return|cancel|reclaim)\w*/gi, ['cancel']],
  [/\baccept\w*/gi, ['accept']],
]
/** Every member word a verb can ask for: a transaction name ending in one of these is a member of its family. */
export const MEMBER_WORDS: ReadonlySet<string> = new Set(ACTION_MEMBERS.flatMap(([, members]) => members))
/** For each verb a text names, the members that answer it ("creates or modifies" → [create, set], [set]). */
export const actionGroups = memoByText((text: string): readonly (readonly string[])[] => {
  // A negated verb asks for nothing: "…recover locked funds if the escrow is never finished" does not ask for EscrowFinish.
  const asserted = text.replace(/\b(?:never|not|no|without|cannot)\s+(?:(?:be|been|being|yet)\s+)?\w+/gi, ' ')
  return Object.freeze(ACTION_MEMBERS.flatMap(([verb, members]) => asserted.match(verb) ? [members] : []))
})
/** The member words a question's verbs ask for (empty when it names no such verb). */
export const actionMembers = memoByText((text: string): ReadonlySet<string> => new Set(actionGroups(text).flat()))
/** The member a transaction name ends in (PermissionedDomainSet → set, EscrowFinish → finish), when it is one of MEMBER_WORDS. */
export const memberOf = (identifier: string) => {
  const last = identifier.match(/[A-Z][a-z]+$/)?.[0]?.toLowerCase()
  return last && MEMBER_WORDS.has(last) ? last : undefined
}
/**
 * 1 when a title names a transaction whose member the question's verbs ask for, -1 when every transaction it names is
 * another member, else 0. Ranks eligible rows for a question that asks for a named thing; it admits nothing.
 */
export function memberRank(question: string, title: string): number {
  const asked = actionMembers(question)
  if (!asked.size) return 0
  const members = identifiersIn(title).filter(isCamelCaseName).map(memberOf).filter((m): m is string => Boolean(m))
  if (!members.length) return 0
  return members.some(m => asked.has(m)) ? 1 : -1
}
