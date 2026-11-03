import { describe, expect, it } from 'vitest'
import { retryAfterMs, retryDelayMs } from '../server/agents/provider-retry.js'
import { createQueryEmbedder } from '../publisher/search.js'

describe('live provider cooldown', () => {
  it('honours short, long and HTTP-date cooldowns without inventing a minute', () => {
    expect(retryAfterMs('2')).toBe(2000)
    expect(retryAfterMs('120')).toBe(120000)
    expect(retryAfterMs('Wed, 21 Oct 2015 07:28:00 GMT', Date.parse('2015-10-21T07:27:58Z'))).toBe(2000)
    expect(retryAfterMs('invalid')).toBe(1000)
    expect(retryDelayMs(2000, () => .5)).toBe(2125)
  })
  it('coalesces an embedding outage and permits recovery after cooldown', async () => {
    let now = 0, calls = 0
    const embed = createQueryEmbedder(async () => { calls++; if (calls === 1) throw new Error('unavailable'); return [[1,2]] }, () => now)
    expect(await embed('Same query')).toBeUndefined()
    expect(await embed(' SAME  QUERY ')).toBeUndefined()
    expect(calls).toBe(1)
    now = 1001
    expect(await embed('same query')).toEqual([1,2])
    expect(calls).toBe(2)
  })
})
