import { expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { packRecording, unpackRecording } from '../demo/recording-codec'

it('restores every field of all six audited recordings exactly', () => {
  for (const file of readdirSync('demo/traces').filter(file => /^UC.*\.json$/.test(file))) {
    const recording = JSON.parse(readFileSync(`demo/traces/${file}`, 'utf8'))
    expect(unpackRecording(packRecording(recording)), file).toEqual(recording)
  }
  for (const file of ['replay-nov11/key-reveal', 'round4-j1/replays/no-show', 'round4-j1/replays/payment']) {
    const proof = JSON.parse(readFileSync(`docs/evidence/${file}/transactions.json`, 'utf8'))
    expect(unpackRecording(packRecording(proof)), file).toEqual(proof)
  }
})
it('restores independent copies and rejects ambiguous or invalid references', () => {
  const original = { text: 'signed envelope'.repeat(30), amount: 40 }
  const decoded = unpackRecording(packRecording([original, original])) as typeof original[]
  decoded[0].amount = 0
  expect(decoded[1]).toEqual(original)
  expect(() => packRecording({ __recording_ref__: 0 })).toThrow('Reserved recording key')
  expect(() => packRecording({ __recording_hex__: '' })).toThrow('Reserved recording key')
  const binary = 'ABCDEF0123456789'.repeat(32)
  expect(unpackRecording(packRecording([binary, binary.toLowerCase()]))).toEqual([binary, binary.toLowerCase()])
  expect(() => unpackRecording('[[],{"__recording_hex__":0}]')).toThrow('Invalid recording hex')
  expect(() => unpackRecording('[[],{"__recording_ref__":0}]')).toThrow('Invalid recording reference')
  expect(() => unpackRecording('[[{"__recording_ref__":0}],{"__recording_ref__":0}]')).toThrow('Invalid recording reference')
})
