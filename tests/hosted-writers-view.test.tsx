// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import WriterEarnings from '../src/components/WriterEarnings'
import { HostedContext } from '../src/hosted'
const verified = {status:'verified',issuerLabel:'ResearchAgent operator',issuer:'rnFqpNSS2rcDoFe72cwneSzwZAhoxqduqr',credentialType:'AB',credentialId:'A'.repeat(64),ledgerIndex:123,checkedAt:'2026-11-12T00:00:00Z'}
const writers = ['Build notes','XRPL explainers','Open Records','Fictional'].map((name,i)=>({slug:String(i),publisherSlug:String(i),name,authorship:i<3?'Team-authored':'Fictional writer',synthetic:i>=2,verification:verified,articleCount:1,articles:[],priceRange:[i===2?0:40],sales:[],trust:[],demoSales:i<3?7:0}))
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
it.each(['verified','check_pending','check_failed'])('fresh hosted view renders all team writers with %s and keeps fiction unverified',async status=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({scope:'Your retained history only.',writers:writers.map((w,i)=>({...w,verification:i<3?{...verified,status}:verified}))})})))
  const {container,unmount}=render(<HostedContext.Provider value={{status:{}} as never}><WriterEarnings /></HostedContext.Provider>)
  await screen.findByRole('link', {name:'Open Records'})
  const cards=container.querySelectorAll('.ra-writer-grid')[0].querySelectorAll('article')
  expect(cards).toHaveLength(3)
  const label=status==='verified'?'XRPL Credential · issued by ResearchAgent operator (Testnet, identity only, not KYC)':status==='check_pending'?'check pending':'check unavailable'
  for(const card of cards) { expect(within(card as HTMLElement).getByText(label)).toBeTruthy(); expect(card.textContent).toContain('You haven’t bought from this writer yet'); expect(card.textContent).toContain('7 sales') }
  expect(screen.getByText('Synthetic demo content')).toBeTruthy()
  expect(screen.getByText('Fictional · unverified')).toBeTruthy()
  expect(container.querySelector('.ra-writer-demo')?.textContent).not.toContain('XRPL Credential')
  unmount()
})
