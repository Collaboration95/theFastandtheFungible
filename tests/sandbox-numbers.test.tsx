// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import SandboxNumbers from '../src/components/hosted/SandboxNumbers'
import { SCOREBOARD_LABEL } from '../server/hosted/stats.js'
const stats={label:SCOREBOARD_LABEL,updatedAt:'2026-11-12T00:00:00Z',questions:4,purchaseRuns:2,purchasesSettled:2,refunds:1,anchored:4,completed:4,inProgress:0,excludedSimulated:0,anchorPending:0,timing:{samples:4,medianMs:25000,p90Ms:40000},medianSpendMinor:50,medianModelUsd:.005,audit:{checked:4,unavailable:0,readBeforeGrant:0,buyWithoutPolicy:0,overBudget:0,duplicateIntent:0,receiptWithoutIntent:0,unanchored:0}}
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
const open=()=>{const details=document.querySelector('details')!;details.open=true;fireEvent(details,new Event('toggle'));return details}
it('loads aggregates only on opening, with no cookies, admission or run requests',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>stats});vi.stubGlobal('fetch',fetcher)
  render(<SandboxNumbers />);expect(fetcher).not.toHaveBeenCalled();open()
  await screen.findByRole('region',{name:'Sandbox scoreboard'})
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher).toHaveBeenCalledWith('/api/demo/stats',expect.objectContaining({credentials:'omit'}))
  expect(screen.getByText(SCOREBOARD_LABEL)).toBeTruthy();expect(screen.getByText('4/4')).toBeTruthy();expect(screen.getByText('US$0.0050')).toBeTruthy()
})
it('shows unavailable instead of invented zero totals when fetching fails',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')))
  render(<SandboxNumbers />);open()
  await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('unavailable'))
  expect(screen.queryByRole('region',{name:'Sandbox scoreboard'})).toBeNull()
})
