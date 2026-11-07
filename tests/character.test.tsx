// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
// @ts-expect-error The generator is plain ESM without type declarations.
import { drift } from '../design/character/build-character.mjs'
import atlas from '../src/assets/character/sprite-atlas.json'
import AgentSprite from '../src/components/AgentSprite'

describe('agent character', () => {
  it('committed exports match the generator', () => {
    // On failure run: node design/character/build-character.mjs
    expect(drift()).toEqual([])
  }, 30_000)

  it('atlas has every pose as one CSS steps() row', () => {
    expect(Object.keys(atlas.animations)).toEqual(['idle', 'walk', 'search', 'thinking', 'pay', 'key-reveal', 'verified', 'refund'])
    for (const [name, row] of Object.entries(atlas.animations)) {
      expect(row.frameNames).toHaveLength(row.frames)
      row.frameNames.forEach((id, i) => expect(atlas.frames[id as keyof typeof atlas.frames]).toEqual({ x: i * atlas.cell.w, y: row.y, w: atlas.cell.w, h: atlas.cell.h, duration: row.duration }))
      expect(row.y + atlas.cell.h, name).toBeLessThanOrEqual(atlas.size.h)
    }
  })

  it('sprite steps through its row and is decorative unless labelled', () => {
    const { container, getByRole } = render(<><AgentSprite animation="thinking" scale={3} /><AgentSprite animation="pay" label="Paying into escrow" /></>)
    const [plain] = container.querySelectorAll<HTMLElement>('.ra-agent-sprite')
    const row = atlas.animations.thinking
    expect(plain.getAttribute('aria-hidden')).toBe('true')
    expect(plain.style.width).toBe(`${atlas.cell.w * 3}px`)
    expect(plain.style.backgroundPosition).toBe(`0px ${-row.y * 3}px`)
    expect(plain.style.getPropertyValue('--ra-agent-n')).toBe(String(row.frames))
    expect(plain.style.getPropertyValue('--ra-agent-end')).toBe(`${-row.frames * atlas.cell.w * 3}px`)
    expect(getByRole('img', { name: 'Paying into escrow' }).dataset.animation).toBe('pay')
    expect(document.querySelector('style')?.textContent).toContain('prefers-reduced-motion:reduce')
  })
})
