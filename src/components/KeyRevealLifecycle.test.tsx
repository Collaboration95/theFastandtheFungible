import { it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import KeyRevealLifecycle from './KeyRevealLifecycle'
import type { EscrowStatus } from '../../shared/contracts/escrow'
const base: EscrowStatus = { scheme:'escrow-v1',policy:'escrow-policy-v1',mode:'key-reveal',state:'LOCKED',owner:'fixture',cancelAfter:2000000000,createHash:'A'.repeat(64) }
const render = (patch: Partial<EscrowStatus>) => renderToStaticMarkup(createElement(KeyRevealLifecycle,{escrow:{...base,...patch}}))
it('shows pending cancellation authority without inventing a proof or refund',()=>{
  const html=render({})
  expect(html).toContain('Escrow created')
  expect(html).toContain('CancelAfter in')
  expect(html).not.toContain('Condition ✓')
  expect(html).not.toContain('principal returned')
})
it('shows individual policy checks, ledger publication and transaction links',()=>{
  const html=render({state:'RELEASED',finishHash:'B'.repeat(64),revealLedger:123,keyVerified:true,decryptVerified:true})
  expect(html).toContain('Writer published key in ledger 123')
  expect(html).toContain('sha256(K) = Condition ✓')
  expect(html).toContain('ciphertext decrypts ✓')
  expect(html).toContain(`https://testnet.xrpl.org/transactions/${'B'.repeat(64)}`)
  expect(render({state:'CANCELLED',cancelHash:'C'.repeat(64)})).toContain("writer didn&#x27;t publish → cancelled, principal returned")
})
