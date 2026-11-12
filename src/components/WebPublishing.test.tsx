// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import WebPublishing from './WebPublishing'
import { publishingRequest } from '../api'
vi.mock('../api',()=>({publishingRequest:vi.fn()}))
afterEach(()=>{cleanup();vi.clearAllMocks();localStorage.clear();window.history.replaceState(null,'','/')})
it('renders labelled phone fields and submits price, payout and topics without a browser seed',async()=>{
  vi.mocked(publishingRequest).mockResolvedValueOnce({enabled:true,minPriceMinor:1,maxPriceMinor:500}).mockResolvedValue({id:'a'.repeat(32),key:'b'.repeat(64),state:'pending'})
  render(<WebPublishing/>);await screen.findByLabelText('Title')
  for(const [label,value] of [['Title','A note title'],['Note (Markdown)','Prepared original body'],['Topics (separated by commas)','escrow, fees']])fireEvent.change(screen.getByLabelText(label),{target:{value}})
  fireEvent.click(screen.getByText('Submit for review'))
  await waitFor(()=>expect(publishingRequest).toHaveBeenCalledWith('/api/publishing/notes','POST',expect.objectContaining({priceMinor:10,payout:'create',topics:['escrow','fees']})))
  await screen.findByText('Pending review')
  expect(localStorage.getItem('ra-publishing')).toContain('bbbb')
})
it('keeps the operator token out of persistent browser storage',async()=>{
  vi.mocked(publishingRequest).mockResolvedValue({enabled:true,minPriceMinor:1,maxPriceMinor:500,notes:[]})
  render(<WebPublishing/>);fireEvent.click(await screen.findByText('Operator review'));fireEvent.change(screen.getByLabelText('Operator token'),{target:{value:'private-operator-value'}});fireEvent.click(screen.getByText('Open queue'))
  await waitFor(()=>expect(publishingRequest).toHaveBeenCalledWith('/api/publishing/operator/queue','GET',undefined,{'X-Operator-Token':'private-operator-value'}))
  expect(JSON.stringify(localStorage)).not.toContain('private-operator-value')
})

it('restores a note from a private fragment link without sending the capability in a URL query',async()=>{
  const id='c'.repeat(32),key='d'.repeat(64)
  window.history.replaceState(null,'',`/?writers=1#publish-note=${id}.${key}`)
  vi.mocked(publishingRequest).mockImplementation(async path=>path.endsWith('/config')?{enabled:true,minPriceMinor:1,maxPriceMinor:100}:{id,state:'live',bought:2,earnedMinor:20})
  render(<WebPublishing/>)
  await screen.findByRole('heading',{name:'Live'})
  expect(publishingRequest).toHaveBeenCalledWith(`/api/publishing/notes/${id}`,'GET',undefined,{'X-Publishing-Key':key})
  const link=screen.getByRole('link',{name:'Save your private status link'}) as HTMLAnchorElement
  expect(new URL(link.href).searchParams.get('writers')).toBe('1')
  expect(new URL(link.href).search).not.toContain(key)
  expect(new URL(link.href).hash).toContain(key)
  expect(screen.getByText(/Bought 2 times, earned S\$0.20/)).toBeTruthy()
  fireEvent.click(screen.getByText('Write another note'));expect(window.location.hash).toBe('')
})
