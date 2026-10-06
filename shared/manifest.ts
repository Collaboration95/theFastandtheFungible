// Manifest proofs (D4), shared by publisher and engine. Node only (node:crypto):
// never import this from src/.
import { createHash } from 'node:crypto'
import { deriveAddress, sign, verify } from 'ripple-keypairs'
import type { ClaimKind, Manifest } from './contracts/manifest.js'
import { countWords } from './contracts/writers.js'

export const MANIFEST_DOMAIN = 'researchagent-manifest-v1:'
export const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

/** Sorted keys, no whitespace; `undefined` object members are dropped, as in JSON.stringify. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(item => item === undefined ? 'null' : canonicalJson(item)).join(',')}]`
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter(key => (value as Record<string, unknown>)[key] !== undefined).sort()
    return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`
  }
  const json = JSON.stringify(value)
  if (json === undefined) throw new Error('canonicalJson: unsupported value')
  return json
}

/** sha256(salt ‖ index ‖ passageId ‖ text), fields joined by U+001F so boundaries are unambiguous. */
export const leafHash = (salt: string, index: number, passageId: string, text: string) => sha256([salt, String(index), passageId, text].join('\u001f'))
/** Leaves are fixed-length hex, so plain concatenation is unambiguous. */
export const manifestRoot = (leaves: string[]) => sha256(leaves.join(''))

/** Hex of the domain prefix + canonical JSON without `sig`. The 'rese…' prefix can never be an XRPL signing payload ('STX\0', 'SMT\0', …). */
export function manifestMessage(manifest: Omit<Manifest, 'sig'> & { sig?: string }): string {
  const { sig: _sig, ...unsigned } = manifest
  return Buffer.from(MANIFEST_DOMAIN + canonicalJson(unsigned), 'utf8').toString('hex').toUpperCase()
}
export const signManifest = (unsigned: Omit<Manifest, 'sig'>, privateKey: string): Manifest => ({ ...unsigned, sig: sign(manifestMessage(unsigned), privateKey) })

/** The signature verifies and the signing key derives to the payee wallet. */
export function verifyManifestSignature(manifest: Manifest): boolean {
  try { return deriveAddress(manifest.pubKey) === manifest.wallet && verify(manifestMessage(manifest), manifest.sig, manifest.pubKey) }
  catch { return false }
}

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/)
const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
const DATE = new RegExp(`\\b(?:\\d{4}-\\d{2}-\\d{2}|${MONTH}\\.?(?:\\s+\\d{1,2}(?:st|nd|rd|th)?,?)?\\s+\\d{4}|\\d{1,2}\\s+${MONTH}\\s+\\d{4}|(?:Q[1-4]|H[12]|FY)\\s?'?\\d{2,4}|(?:19|20)\\d{2})\\b`, 'i')
const UNIT_NUMBER = /(?:[$€£¥]\s?\d[\d,.]*|\b\d[\d,.]*\s?(?:%|percent|per cent|bps?|basis points|nm|[MGK]W|[MGT]Wh|wafers?|units|billion|million|trillion|bn|tn|yen|dollars|x)(?![A-Za-z]))/gi

/** Claim-kind checkers: the single source for publisher and client. */
export const CLAIM_KINDS: Record<ClaimKind, (passage: string) => boolean> = {
  // A date expression and a separate number in the same sentence.
  'dated-figure': passage => sentences(passage).some(s => DATE.test(s) && /\d/.test(s.replace(new RegExp(DATE.source, 'gi'), ' '))),
  // "according to <Capitalised Name>" or a quote attributed with said/says/wrote/told.
  'named-source': passage => /\b[Aa]ccording to (?:the )?[A-Z][\w&.-]*/.test(passage)
    || /["“][^"”]{3,}["”],?\s+(?:said|says|wrote|writes|told)\s+(?:the\s+)?[A-Z]/.test(passage)
    || /\b[A-Z][\w.-]*(?:\s+[A-Z][\w.-]*)*,?\s+(?:said|says|wrote|writes|told \w+)[,:]?\s*["“]/.test(passage),
  // At least 3 numbers with units or percentages in one passage.
  'numeric-series': passage => (passage.match(UNIT_NUMBER) ?? []).length >= 3,
}

export type DeliveredPassage = { id: string; text: string }
export type DeliveryCheck = { ok: boolean; rootOk: boolean; wordCountOk: boolean; failedClaims: string[] }

/** Recomputes leaves and root from the delivered bytes, then runs each claim's checker on its bound passage. */
export function verifyDelivery(body: string, passages: DeliveredPassage[], salts: string[], manifest: Manifest): DeliveryCheck {
  const leaves = passages.map((p, i) => body.includes(p.text) && salts[i] !== undefined ? leafHash(salts[i], i, p.id, p.text) : '')
  const rootOk = passages.length === manifest.leaves.length && leaves.every((leaf, i) => leaf === manifest.leaves[i]) && manifestRoot(manifest.leaves) === manifest.root
  const wordCountOk = countWords(body) === manifest.wordCount
  const failedClaims = manifest.claims.filter(claim => {
    const index = leaves.indexOf(claim.leaf)
    return index < 0 || !CLAIM_KINDS[claim.kind](passages[index].text)
  }).map(claim => claim.id)
  return { ok: rootOk && wordCountOk && failedClaims.length === 0, rootOk, wordCountOk, failedClaims }
}
