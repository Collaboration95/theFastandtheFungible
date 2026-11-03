// Private engine/publisher boundary. Never import into the browser or a model tool.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { conditionFor } from './escrow.js'
import { canonicalJson } from './manifest.js'
import type { EscrowQuote } from './contracts/escrow.js'
import { verifyEscrowQuote } from './escrow.js'

export const bytesHash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')
export function encryptDelivery(delivery: unknown) {
  const key = randomBytes(32), iv = randomBytes(12), bytes = Buffer.from(canonicalJson(delivery))
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()])
  return { secret: key.toString('hex').toUpperCase(), ciphertext: ciphertext.toString('hex').toUpperCase(), condition: conditionFor(key.toString('hex')), commitment: { ciphertextHash: bytesHash(ciphertext), plaintextHash: bytesHash(bytes), iv: iv.toString('hex').toUpperCase(), tag: cipher.getAuthTag().toString('hex').toUpperCase() } }
}
export function decryptDelivery(quote: EscrowQuote, key: string): unknown {
  const c = quote.terms.keyReveal
  if (!c || !quote.ciphertext || !/^[A-F0-9]{64}$/.test(key) || !verifyEscrowQuote(quote) || conditionFor(key) !== quote.terms.condition) throw new Error('Key reveal binding rejected')
  const ciphertext = Buffer.from(quote.ciphertext, 'hex')
  if (bytesHash(ciphertext) !== c.ciphertextHash) throw new Error('Ciphertext commitment rejected')
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(c.iv, 'hex'))
  decipher.setAuthTag(Buffer.from(c.tag, 'hex'))
  const bytes = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  if (bytesHash(bytes) !== c.plaintextHash) throw new Error('Plaintext commitment rejected')
  return JSON.parse(bytes.toString('utf8'))
}
