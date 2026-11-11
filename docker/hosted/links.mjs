// Public links an operator can set on the state disk without a redeploy (H7, J3): `links.json` beside the control file.
// The API re-reads it on every status call; scripts/hosted-control.mjs writes it. Shared so both check the same rule.
export const LINK_KEYS = ['video', 'proof']
export const LINKS_FILE = 'links.json'
/** https only, a real host, no credentials, no whitespace, quotes or angle brackets, at most 300 characters. */
export function validLink(value) {
  if (typeof value !== 'string' || value.length > 300 || !/^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:[/?#][^\s"'<>\\`]*)?$/.test(value)) return false
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.') } catch { return false }
}
/** The usable links of a parsed file: only known keys with valid values. Anything else is ignored, never trusted. */
export function cleanLinks(doc) {
  const out = {}
  if (doc && typeof doc === 'object' && !Array.isArray(doc)) for (const key of LINK_KEYS) if (validLink(doc[key])) out[key] = doc[key]
  return out
}
