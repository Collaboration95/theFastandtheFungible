// Repeated signed envelopes can be farther apart than gzip's 32 KiB window.
// Store repeated JSON subtrees once, then restore independent copies before validation.
const reference = '__recording_ref__'
type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export function packRecording(value: Json): string {
  const counts = new Map<string, number>()
  const visit = (node: Json) => {
    if (!node || typeof node !== 'object') return
    if (!Array.isArray(node) && reference in node) throw Error('Reserved recording key')
    const key = JSON.stringify(node)
    if (key.length >= 256) counts.set(key, (counts.get(key) ?? 0) + 1)
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
    if (!Array.isArray(node) && reference in node) {
      const index = node[reference]
      if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= values.length || parents.has(index)) throw Error('Invalid recording reference')
      return decode(values[index], new Set([...parents, index]))
    }
    return Array.isArray(node) ? node.map(item => decode(item, parents)) : Object.fromEntries(Object.entries(node).map(([key, item]) => [key, decode(item, parents)]))
  }
  return decode(data)
}
