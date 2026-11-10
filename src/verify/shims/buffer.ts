/** The few Buffer operations the receipt verifier uses, for the browser. Not a general Node polyfill. */
type Encoding = 'utf8' | 'utf-8' | 'hex' | 'base64'
export class Bytes extends Uint8Array {
  // A string argument keeps Node's Buffer#toString(encoding) shape; Uint8Array#toString takes none.
  override toString(encoding: Encoding = 'utf8'): string {
    if (encoding === 'hex') return Array.from(this, byte => byte.toString(16).padStart(2, '0')).join('')
    if (encoding === 'base64') return btoa(Array.from(this, byte => String.fromCharCode(byte)).join(''))
    return new TextDecoder().decode(this)
  }
  equals(other: Uint8Array) { return other.length === this.length && this.every((byte, i) => byte === other[i]) }
}
function from(value: string | ArrayLike<number> | ArrayBuffer, encoding: Encoding = 'utf8'): Bytes {
  if (typeof value !== 'string') { const out = new Bytes(value instanceof ArrayBuffer ? value.byteLength : value.length); out.set(value instanceof ArrayBuffer ? new Uint8Array(value) : value); return out }
  if (encoding === 'hex') {
    if (value.length % 2 || /[^0-9a-f]/i.test(value)) throw new TypeError('Invalid hex string')
    const out = new Bytes(value.length / 2)
    for (let i = 0; i < out.length; i++) out[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16)
    return out
  }
  if (encoding === 'base64') return from(Array.from(atob(value), char => char.charCodeAt(0)))
  return from(new TextEncoder().encode(value))
}
function concat(list: readonly Uint8Array[]): Bytes {
  const out = new Bytes(list.reduce((sum, item) => sum + item.length, 0))
  let offset = 0
  for (const item of list) { out.set(item, offset); offset += item.length }
  return out
}
export const BrowserBuffer = { from, concat, alloc: (size: number) => new Bytes(size), isBuffer: (value: unknown): value is Bytes => value instanceof Bytes }
