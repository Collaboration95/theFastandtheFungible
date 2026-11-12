import { appendFileSync, closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, truncateSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function syncFile(file) { const fd = openSync(file, 'r'); try { fsyncSync(fd) } finally { closeSync(fd) } }
export function atomic(file, value) { writeFileSync(file + '.next', JSON.stringify(value), { mode: 0o600 }); syncFile(file + '.next'); renameSync(file + '.next', file); syncFile(dirname(file)) }
export function append(file, value) { appendFileSync(file, JSON.stringify(value) + '\n', { mode: 0o600 }); syncFile(file); syncFile(dirname(file)) }
// A killed append can leave an incomplete final line. Never discard a complete row.
export function rows(file, recover = false) {
  if (!existsSync(file)) return []
  let bytes = readFileSync(file)
  if (bytes.length && bytes.at(-1) !== 10) {
    if (!recover) throw Error('Incomplete JSONL tail')
    const length = bytes.lastIndexOf(10) + 1
    truncateSync(file, length); syncFile(file); bytes = bytes.subarray(0, length)
  }
  return bytes.toString().split('\n').filter(Boolean).map(line => JSON.parse(line))
}
export function receiptIndex(receipts) {
  const index = new Map()
  for (const r of receipts) { if (index.has(r.intentId)) throw Error('Duplicate intent in receipts'); index.set(r.intentId, r) }
  return index
}
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
export function cause(error) {
  const code = error?.data?.error
  if (typeof code === 'string' && /^[a-zA-Z0-9_]{1,60}$/.test(code)) return code
  if (/faucet/i.test(error?.message ?? '')) return 'faucet_unavailable'
  if (/timeout|timed out/i.test(error?.message ?? '')) return 'timeout'
  return 'node_or_transport_error'
}
