import {expect,it} from 'vitest'
import {answersFromAccessible,answersIt} from '../scripts/judge-bank-scorer.js'
const citation={profileId:'public-docs',resourceId:'escrow',version:'1',spanId:'s1'}
it('can credit a cited free answer without counting it as paid evidence',()=>{
 const lead=[{text:'EscrowCancel returns expired escrow to its sender.',citations:[citation]}]
 expect(answersFromAccessible('EscrowCancel',lead,[citation])).toBe(1)
 expect(answersIt('EscrowCancel',lead,[])).toBe(0)
 expect(answersFromAccessible('EscrowCancel',lead,[{...citation,spanId:'other'}])).toBe(0)
 expect(answersFromAccessible('EscrowCancel',[{...lead[0],citations:[]}],[citation])).toBe(0)
})
