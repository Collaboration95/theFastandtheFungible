// Browser stand-in for the node:crypto calls the receipt verifier makes (bundled only into the lazy verifier chunk).
// SHA-256 is synchronous (@noble/hashes, already shipped with xrpl). AES-256-GCM is only ever *decryption* of a key
// the writer already published on the ledger: WebCrypto does it (asynchronously, with the authentication tag) in
// `prepareDecryptions` before verification starts; the synchronous decipher below only returns those results.
import { sha256 } from '@noble/hashes/sha2'
import { BrowserBuffer } from './buffer'

type Encoding = 'utf8' | 'hex' | 'base64'
const hex = (bytes: Uint8Array) => BrowserBuffer.from(bytes).toString('hex')
// WebCrypto wants ArrayBuffer-backed views; every buffer here is one (never shared memory).
const view = (bytes: Uint8Array) => bytes as Uint8Array<ArrayBuffer>
const bytesOf = (data: string | Uint8Array, encoding: Encoding = 'utf8') => typeof data === 'string' ? BrowserBuffer.from(data, encoding) : data

export function createHash(algorithm: string) {
  if (algorithm !== 'sha256') throw new Error(`Unsupported hash in the browser verifier: ${algorithm}`)
  const chunks: Uint8Array[] = []
  const hash = {
    update(data: string | Uint8Array, encoding?: Encoding) { chunks.push(bytesOf(data, encoding)); return hash },
    digest(encoding?: Encoding) { const out = BrowserBuffer.from(sha256(BrowserBuffer.concat(chunks))); return encoding ? out.toString(encoding) : out },
  }
  return hash
}
export function randomBytes(size: number) { return BrowserBuffer.from(crypto.getRandomValues(new Uint8Array(size))) }
export function createCipheriv(): never { throw new Error('The browser verifier never encrypts') }

const decrypted = new Map<string, Uint8Array>()
const entry = (key: Uint8Array, iv: Uint8Array, tag: Uint8Array, ciphertext: Uint8Array) => `${hex(key)}:${hex(iv)}:${hex(tag)}:${hex(ciphertext)}`
/** Authenticated AES-256-GCM decryption with WebCrypto. A wrong key or tag rejects and is simply not recorded. */
export async function prepareDecryption(keyHex: string, ivHex: string, tagHex: string, ciphertextHex: string) {
  const key = BrowserBuffer.from(keyHex, 'hex'), iv = BrowserBuffer.from(ivHex, 'hex'), tag = BrowserBuffer.from(tagHex, 'hex'), ciphertext = BrowserBuffer.from(ciphertextHex, 'hex')
  try {
    const cryptoKey = await crypto.subtle.importKey('raw', view(key), 'AES-GCM', false, ['decrypt'])
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: view(iv), tagLength: tag.length * 8 }, cryptoKey, view(BrowserBuffer.concat([ciphertext, tag]))))
    decrypted.set(entry(key, iv, tag, ciphertext), plain)
  } catch { /* Authentication failed: the verifier's synchronous decipher will throw and the check fails closed. */ }
}
export function createDecipheriv(algorithm: string, key: Uint8Array, iv: Uint8Array) {
  if (algorithm !== 'aes-256-gcm') throw new Error(`Unsupported cipher in the browser verifier: ${algorithm}`)
  let tag: Uint8Array = new Uint8Array(0)
  const chunks: Uint8Array[] = []
  return {
    setAuthTag(value: Uint8Array) { tag = value },
    update(data: Uint8Array) { chunks.push(data); return BrowserBuffer.alloc(0) },
    final() {
      const plain = decrypted.get(entry(key, iv, tag, BrowserBuffer.concat(chunks)))
      if (!plain) throw new Error('Unsupported state or unable to authenticate data')
      return BrowserBuffer.from(plain)
    },
  }
}
export default { createHash, randomBytes, createCipheriv, createDecipheriv }
