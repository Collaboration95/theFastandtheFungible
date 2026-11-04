import { expect, it } from 'vitest'
import { verifyEscrowCredit } from '../server/escrow-asset.js'
import type { EscrowTerms } from '../shared/contracts/escrow.js'
it('uses the recipient trust-line delta, rejecting short settlement and wrong asset or party', () => {
  const t={amount:'0.06',asset:{currency:'SGT',issuer:'issuer'}} as EscrowTerms
  const meta={AffectedNodes:[{ModifiedNode:{LedgerEntryType:'RippleState',PreviousFields:{Balance:{value:'-1'}},FinalFields:{LowLimit:{issuer:'issuer'},HighLimit:{issuer:'writer'},Balance:{currency:'SGT',value:'-1.06'}}}}]}
  expect(()=>verifyEscrowCredit(meta,t,'writer')).not.toThrow()
  for(const changed of [{...t,amount:'0.07'},{...t,asset:{...t.asset as object,currency:'USD'}},{...t,asset:{...t.asset as object,issuer:'other'}}]) expect(()=>verifyEscrowCredit(meta,changed as EscrowTerms,'writer')).toThrow()
  expect(()=>verifyEscrowCredit(meta,t,'buyer')).toThrow()
  expect(()=>verifyEscrowCredit({delivered_amount:'0.06'},t,'writer')).toThrow()
})
