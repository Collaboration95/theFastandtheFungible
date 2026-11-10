/** Generic answer typing for "which/what X" questions (lane K5).
 *
 * A question that asks "which flag", "what share", "which act" wants a sentence
 * that NAMES one thing of that kind. These rules recognise the shape of such a
 * name (an identifier, header, code, percentage, numbered clause, statute title)
 * without knowing any particular answer: no bank phrase, gold string or article
 * title appears here. Shapes come from how protocols, standards and statutes
 * are written, so they apply to a judge's own question as much as to ours. */

export type AskedKind = 'transaction' | 'flag' | 'header' | 'standard' | 'code' | 'share' | 'quantity' | 'numbered' | 'law' | 'field' | 'type' | 'feature'

/** Noun that decides the kind, in the order they are tried when several appear. */
const KIND_NOUNS: [AskedKind, RegExp][] = [
  ['transaction', /\b(?:transaction|operation)(?:\s+type)?s?\b(?!\s+(?:cost|fee|hash|id|result|history|data|ledger))/i],
  ['flag', /\bflags?\b/i],
  ['header', /\bheaders?\b/i],
  ['code', /\b(?:currency|error|status|result|hex)?\s*codes?\b/i],
  ['share', /\b(?:share|percentage|percent|proportion|fraction|threshold|quorum|majority|supermajority)\b/i],
  ['numbered', /\b(?:recommendation|article|section|clause|chapter|annex|principle|rule\s+number|directive)s?\b/i],
  ['law', /\b(?:act|law|statute|regulation|legislation|framework|directive)s?\b/i],
  ['standard', /\b(?:amendment|standard|proposal|specification|XLS)s?\b/i],
  ['field', /\b(?:field|parameter|setting|property|attribute|permission)s?\b/i],
  ['type', /\b(?:type|kind|variant)s?\b/i],
  ['feature', /\b(?:feature|mechanism|primitive|object|tool|method|scheme|protocol|function)s?\b/i],
]
/** Kinds whose answer is a number: a sentence with no number cannot be the answer. */
export const numericKind = (kind: AskedKind | undefined) => kind === 'share' || kind === 'quantity'
const QUANTITY_NOUN = /\bhow\s+(?:many|much|long|often)\b|\b(?:maximum|minimum|limit|cap|fee|cost|reserve|amount|number|price|rate|size|length|duration|delay|period|window|count)s?\b/i

/** What a "which/what/how …" question asks the answer to be, or undefined when it
 * asks for an explanation, reason or yes/no rather than a named thing. */
export function askedKind(fact: string): AskedKind | undefined {
  const wh = /\b(?:which|what|how(?:\s+(?:many|much))?|in\s+which)\b/i.exec(fact)
  if (!wh) return undefined
  const rest = fact.slice(wh.index)
  if (/^(?:which|what)\s+(?:does|do|did|happens?|is\s+the\s+difference)\b/i.test(rest) && !/\bcodes?\b/i.test(rest.slice(0, 60))) return undefined
  // The asked noun sits in the few words right after the wh-word; a noun further
  // on belongs to the rest of the sentence ("How does X settle a transaction?").
  if (/^how\s+(?:many|much|long|often)\b/i.test(rest)) return 'quantity'
  const window = rest.split(/\s+/).slice(0, 7).join(' ')
  let best: { kind: AskedKind; at: number } | undefined
  for (const [kind, pattern] of KIND_NOUNS) {
    const hit = pattern.exec(window)
    if (hit && (!best || hit.index < best.at)) best = { kind, at: hit.index }
  }
  // A quantity noun ("limit", "cost") only decides when no other kind of thing is
  // asked for: "Which field limits the release time?" is about a field.
  return best?.kind ?? (QUANTITY_NOUN.test(window) ? 'quantity' : undefined)
}

const CAMEL = /\b(?:[A-Z]{2,}[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)*|[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+|[a-z]+(?:[A-Z][a-z0-9]*)+)\b/g
const FLAG = /\b(?:tf|lsf|asf)[A-Z][A-Za-z0-9]+\b|\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g
const KEBAB_CAPS = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/g
const STANDARD_ID = /\bXLS-\d+\b|\b(?:RFC|BIP|EIP|ISO)[- ]?\d+\b/g
/** A global regex keeps state across `.test`; this one is only for testing a single name. */
const IS_STANDARD_ID = /^(?:XLS-\d+|(?:RFC|BIP|EIP|ISO)[- ]?\d+)$/
const HEX_CODE = /\b(?=[0-9A-F]*\d)(?=[0-9A-F]*[A-F])[0-9A-F]{8,}\b/g
const UPPER_CODE = /\b[A-Z]{3,6}\b/g
const SHARE = /\b\d{1,3}(?:\.\d+)?\s?(?:%|(?:percent|per\s?cent)\b)|\b(?:two|three)[- ](?:thirds|quarters|fifths)\b|\b(?:super)?majority\b/gi
const QUANTITY_UNIT = /\b\d[\d,.]*\s?(?:%|(?:percent|XRP|drops?|days?|business\s+days?|hours?|minutes?|seconds?|weeks?|months?|years?|SGD|USD|bp|basis\s+points)\b)/gi
const QUANTITY_CODE = /\b\d[\d,.]*\s?[A-Z]{3,4}\b/g
const NUMBERED = /\b(?:Recommendation|Article|Section|Clause|Chapter|Annex|Principle|Directive|Rule|Step|Phase)\s+\d+[A-Za-z]?\b|\b(?:FATF\s+)?R\.?\s?\d{1,2}\b/g
const LAW = /\b(?:(?:[A-Z][A-Za-z]*\s+){1,5}(?:Act|Law|Regulations?|Directive|Statute|Code)|The\s+[A-Z][A-Za-z]+\s+Act|[A-Z]{3,}\s+Act)\b/g
const TRANSACTION_VERB = /(?:Create|Finish|Cancel|Set|Delete|Deposit|Withdraw|Bid|Vote|Accept|Fund|Claim|Cash|Mint|Burn|Clawback|Authorize|Destroy|Fix|Commit|Payment|Offer|Preauth|Key|Batch|Modify|Update|Issue|Revoke|Remove|Submit)$|^Set[A-Z]/
const FLAG_PREFIX = /^(?:tf|lsf|asf)[A-Z]/
const RESULT_CODE = /^t(?:es|ec|em|er|el|ef)[A-Z]/
const matches = (pattern: RegExp, text: string) => text.match(pattern) ?? []

/** The names in `text` that answer a question of this kind, ignoring anything the
 * question already says (it cannot be the answer). Empty when none is present. */
export function answerNames(kind: AskedKind, text: string, question: string): string[] {
  const asked = question.toLowerCase()
  const fresh = (names: string[]) => [...new Set(names)].filter(name => !asked.includes(name.toLowerCase()))
  switch (kind) {
    case 'transaction': return fresh(matches(CAMEL, text).filter(name => TRANSACTION_VERB.test(name) && !FLAG_PREFIX.test(name) && !RESULT_CODE.test(name)))
    case 'flag': return fresh([...matches(FLAG, text), ...matches(CAMEL, text).filter(name => FLAG_PREFIX.test(name))])
    case 'header': return fresh(matches(KEBAB_CAPS, text).filter(name => !IS_STANDARD_ID.test(name) && !/\d$/.test(name)))
    case 'code': return fresh([...matches(HEX_CODE, text), ...matches(CAMEL, text).filter(name => RESULT_CODE.test(name)), ...matches(UPPER_CODE, text)])
    case 'share': return fresh([...matches(SHARE, text), ...matches(QUANTITY_UNIT, text), ...matches(QUANTITY_CODE, text)])
    case 'quantity': return fresh([...matches(QUANTITY_UNIT, text), ...matches(QUANTITY_CODE, text)])
    case 'numbered': return fresh([...matches(NUMBERED, text), ...matches(STANDARD_ID, text)])
    case 'law': return fresh(matches(LAW, text))
    case 'standard': return fresh([...matches(STANDARD_ID, text), ...matches(CAMEL, text).filter(name => !TRANSACTION_VERB.test(name) && !FLAG_PREFIX.test(name))])
    case 'field': return fresh(matches(CAMEL, text).filter(name => !FLAG_PREFIX.test(name) && !RESULT_CODE.test(name)))
    case 'type': return fresh([...matches(KEBAB_CAPS, text).filter(name => !IS_STANDARD_ID.test(name)), ...matches(CAMEL, text)])
    case 'feature': return fresh([...matches(CAMEL, text), ...matches(KEBAB_CAPS, text)])
  }
}
