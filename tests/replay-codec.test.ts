import { expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { packRecording, unpackRecording } from '../demo/recording-codec'

it('restores every field of all six audited recordings exactly', () => {
  for (const file of readdirSync('demo/traces').filter(file => /^UC.*\.json$/.test(file))) {
    const recording = JSON.parse(readFileSync(`demo/traces/${file}`, 'utf8'))
    expect(unpackRecording(packRecording(recording)), file).toEqual(recording)
  }
})
it('restores independent copies and rejects ambiguous or invalid references', () => {
  const original = { text: 'signed envelope'.repeat(30), amount: 40 }
  const decoded = unpackRecording(packRecording([original, original])) as typeof original[]
  decoded[0].amount = 0
  expect(decoded[1]).toEqual(original)
  expect(() => packRecording({ __recording_ref__: 0 })).toThrow('Reserved recording key')
  expect(() => unpackRecording('[[],{"__recording_ref__":0}]')).toThrow('Invalid recording reference')
  expect(() => unpackRecording('[[{"__recording_ref__":0}],{"__recording_ref__":0}]')).toThrow('Invalid recording reference')
})
