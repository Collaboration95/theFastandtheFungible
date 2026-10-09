/**
 * Best-effort parse of a JSON prefix, as a model streams it: open strings, arrays and objects are closed where the
 * text stops, and a key or literal cut off mid-way is left out. Never throws on a valid prefix; returns undefined
 * when nothing usable has arrived. Display only: the full text is still parsed strictly once the stream ends.
 */
const MISSING = Symbol('missing')
const ESCAPES: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }

export function parsePartialJson(text: string): unknown {
  let i = 0
  const ws = () => { while (i < text.length && /\s/.test(text[i])) i++ }
  const string = (): { value: string; closed: boolean } => {
    i++ // opening quote
    let value = ''
    while (i < text.length) {
      const c = text[i]
      if (c === '"') { i++; return { value, closed: true } }
      if (c !== '\\') { value += c; i++; continue }
      const e = text[i + 1]
      if (e === undefined) break
      if (e === 'u') {
        const hex = text.slice(i + 2, i + 6)
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) break
        value += String.fromCharCode(parseInt(hex, 16)); i += 6
      } else { value += ESCAPES[e] ?? e; i += 2 }
    }
    i = text.length
    return { value, closed: false }
  }
  const value = (): unknown => {
    ws()
    if (i >= text.length) return MISSING
    const c = text[i]
    if (c === '"') return string().value
    if (c === '{') {
      i++
      const out: Record<string, unknown> = {}
      for (;;) {
        ws()
        if (i >= text.length) return out
        if (text[i] === '}') { i++; return out }
        if (text[i] === ',') { i++; continue }
        if (text[i] !== '"') { i = text.length; return out }
        const key = string()
        if (!key.closed) return out
        ws()
        if (text[i] !== ':') { i = text.length; return out }
        i++
        const item = value()
        if (item !== MISSING) out[key.value] = item
      }
    }
    if (c === '[') {
      i++
      const out: unknown[] = []
      for (;;) {
        ws()
        if (i >= text.length) return out
        if (text[i] === ']') { i++; return out }
        if (text[i] === ',') { i++; continue }
        const item = value()
        if (item !== MISSING) out.push(item)
      }
    }
    // Numbers and literals count only once a delimiter shows they are complete.
    const literal = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)(?=[\s,\]}])/.exec(text.slice(i))
    if (!literal) { i = text.length; return MISSING }
    i += literal[0].length
    return JSON.parse(literal[0])
  }
  const result = value()
  return result === MISSING ? undefined : result
}
