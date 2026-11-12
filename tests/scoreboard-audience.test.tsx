// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import Numbers from '../src/components/hosted/SandboxNumbersPanel'
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
const population={label:'XRPL Testnet · test funds · includes our own test runs since 11 Nov',questions:4,purchaseRuns:2,purchasesSettled:2,refunds:0,anchored:4,medianSpendMinor:40,medianModelUsd:0,timing:{medianMs:1000,p90Ms:2000,samples:4},audit:{checked:4,unavailable:0,readBeforeGrant:0,buyWithoutPolicy:0,overBudget:0,duplicateIntent:0,receiptWithoutIntent:0,unanchored:0},stoppedBeforeAnswer:1,inProgress:0,anchorPending:0,excludedSimulated:0}
it.each([0,1])('selects a consistent headline when external questions=%s and labels the full audit',async(count)=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...population,updatedAt:'2026-11-12T10:00:00.000Z',all:population,external:{...population,questions:count},unclassified:2})}))
 render(<Numbers/>);await screen.findByRole('heading',{name:'Sandbox scoreboard'})
 expect(screen.getByText('Questions').parentElement?.textContent).toBe(`Questions${count||4}`)
 expect(screen.getByText('Anchored').parentElement?.textContent).toBe(`Anchored4/${count||4}`)
 expect(screen.getByText(/confirmed external/).textContent).toContain(`${count} confirmed external · 4 all · 2 historical`)
 expect(screen.getByRole('heading',{name:'Gate audit · all runs with a recorded violation'})).toBeTruthy()
 expect(screen.getByText(count?'XRPL Testnet · external visitors since 11 Nov':population.label)).toBeTruthy()
})
