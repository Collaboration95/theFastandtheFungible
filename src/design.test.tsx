import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('enforces the shared UX type scale and motion allowlist', () => {
  const css = readFileSync('src/tokens.css', 'utf8') + readFileSync('src/styles.css', 'utf8')
  expect([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1])).toEqual(['fade-in', 'spin', 'countdown'])
  expect(css.match(/\binfinite\b/g)).toHaveLength(2)
  expect(css).not.toMatch(/--(?:pen|hi|pay)(?:-|:)|gradient\(|clamp\(|--ease-spring|animation-delay:\s*calc|\bshimmer\s+\d/)
  const sizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(m => Number(m[1]))
  expect([...new Set(sizes)].sort((a,b) => a-b)).toEqual([12,13,14,15,20,28,32])
})

it('uses three responsive regimes, shared geometry tokens and visible reduced-motion confirmation', () => {
 const css = readFileSync('src/tokens.css', 'utf8') + readFileSync('src/styles.css', 'utf8')
 expect([...new Set([...css.matchAll(/@media[^{}]*max-width:\s*(\d+)px/g)].map(m => Number(m[1])))].sort((a,b)=>a-b)).toEqual([780,1100])
 expect(css).not.toMatch(/\{\s*\}|\}\s*\{/)
 for (const name of ['space-1','space-4','radius-sm','radius-md','shadow-pop','dur-fast','focus','rule-strong']) expect(css).toContain(`--${name}:`)
})

it('keeps warning text and control boundaries readable on each light surface', () => {
 const css=readFileSync('src/tokens.css','utf8')
 const color=(token:string)=>{const hex=css.match(new RegExp('--'+token+': (#[0-9A-F]{6})'))![1];return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[0.2126,0.7152,0.0722][i],0)}
 const contrast=(a:string,b:string)=>{const [lo,hi]=[color(a),color(b)].sort((x,y)=>x-y);return (hi+0.05)/(lo+0.05)}
 for(const surface of ['paper','surface','hover']) {expect(contrast('rule-strong',surface)).toBeGreaterThanOrEqual(3);expect(contrast('warn',surface)).toBeGreaterThanOrEqual(4.5)}
})
