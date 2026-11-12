// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import LiveFeed from '../src/live/LiveFeed'
import fixture from './fixtures/public-feed.json'
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
it('keeps provenance on the writer badge and animates only newly arrived purchases',async()=>{
 let receive:(event:MessageEvent)=>void=()=>{}
 const close=vi.fn()
 vi.stubGlobal('EventSource',class {
  addEventListener(_name:string,listener:(event:MessageEvent)=>void){receive=listener}
  close=close
 })
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('fixture offline')))
 const view=render(<LiveFeed/>), first={...fixture.rows[0],writer:'Ledger Notes · fictional author'}
 const send=async(rows:unknown[])=>act(async()=>receive(new MessageEvent('snapshot',{data:JSON.stringify({rows,updatedAt:'2026-11-12T10:00:00.000Z'})})))
 await send([first])
 expect(screen.getByText('Ledger Notes')).toBeTruthy()
 expect(screen.getByText('Fictional writer').closest('td')).toBeTruthy()
 expect(screen.getByText('Ledger Notes · fictional author').closest('details')).toBeTruthy()
 expect(document.querySelectorAll('.ra-live-new')).toHaveLength(0)
 fireEvent.click(screen.getByRole('button',{name:'Live purchases'}))
 expect(screen.getByText('Ledger Notes')).toBeTruthy()
 expect(screen.getByText('Live updates connected').getAttribute('role')).toBe('status')
 await send([{...first,id:'b'.repeat(24)},first])
 expect(document.querySelectorAll('.ra-live-new')).toHaveLength(1)
 await send([{...first,id:'b'.repeat(24),state:'finished'},first])
 expect(document.querySelectorAll('.ra-live-new')).toHaveLength(0)
 view.unmount();expect(close).toHaveBeenCalledOnce()
})
