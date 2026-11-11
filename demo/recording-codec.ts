// Repeated signed envelopes can be farther apart than gzip's 32 KiB window.
// Store repeated JSON subtrees once, then restore independent copies before validation.
const reference = '__recording_ref__'
const binary = '__recording_hex__'
type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export function packRecording(value: Json): string {
  const compact = (node: Json): Json => {
    if (typeof node === 'string' && /^(?:[A-F0-9]{2}){64,}$/.test(node)) return { [binary]: btoa(node.match(/../g)!.map(byte => String.fromCharCode(parseInt(byte, 16))).join('')) }
    if (!node || typeof node !== 'object') return node
    if (!Array.isArray(node) && (reference in node || binary in node)) throw Error('Reserved recording key')
    return Array.isArray(node) ? node.map(compact) : Object.fromEntries(Object.entries(node).map(([key, item]) => [key, compact(item)]))
  }
  value = compact(value)
  const counts = new Map<string, number>()
  const visit = (node: Json) => {
    if (!node || typeof node !== 'object') return
    if (!Array.isArray(node) && reference in node) throw Error('Reserved recording key')
    const key = JSON.stringify(node)
    if (key.length >= 1024) counts.set(key, (counts.get(key) ?? 0) + 1)
    Object.values(node).forEach(visit)
  }
  visit(value)
  const values = [...counts].filter(([, count]) => count > 1).map(([key]) => key)
  const indices = new Map(values.map((key, index) => [key, index]))
  const encode = (node: Json, root = false): Json => {
    if (!node || typeof node !== 'object') return node
    const index = root ? undefined : indices.get(JSON.stringify(node))
    if (index !== undefined) return { [reference]: index }
    return Array.isArray(node) ? node.map(item => encode(item)) : Object.fromEntries(Object.entries(node).map(([key, item]) => [key, encode(item)]))
  }
  return JSON.stringify([values.map(key => encode(JSON.parse(key), true)), encode(value)])
}
export function unpackRecording(packed: string): unknown {
  const [values, data] = JSON.parse(packed) as [Json[], Json]
  const decode = (node: Json, parents = new Set<number>()): Json => {
    if (!node || typeof node !== 'object') return node
    if (!Array.isArray(node) && binary in node) {
      if (typeof node[binary] !== 'string') throw Error('Invalid recording hex')
      return Array.from(atob(node[binary]), byte => byte.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase()
    }
    if (!Array.isArray(node) && reference in node) {
      const index = node[reference]
      if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= values.length || parents.has(index)) throw Error('Invalid recording reference')
      return decode(values[index], new Set([...parents, index]))
    }
    return Array.isArray(node) ? node.map(item => decode(item, parents)) : Object.fromEntries(Object.entries(node).map(([key, item]) => [key, decode(item, parents)]))
  }
  return decode(data)
}
