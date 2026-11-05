import { expect, it, vi } from 'vitest'
import { createClient, ResearchAgentError } from '../sdk/index.js'
import { errorEnvelope } from '../shared/contracts/errors.js'
it.each(['cap_zero','paused','budget_exhausted','per_call_cap','overloaded','deadline','settlement_pending','unauthorized','backend_unavailable'] as const)('preserves safe %s errors', async code => {
  const client = createClient({ baseUrl:'https://fixture.invalid', fetch: async()=>new Response(JSON.stringify({...errorEnvelope(code,503,'retained-run'),message:'PRIVATE'}),{status:503}) })
  await expect(client.wallet()).rejects.toMatchObject({code,status:503,runId:'retained-run'})
  await expect(client.wallet()).rejects.not.toThrow('PRIVATE')
})
it.each(['http://remote.invalid','https://user:password@remote.invalid','http://127.0.0.1.evil.invalid'])('rejects unsafe bearer target %s before transport', url=>{
  const transport=vi.fn()
  expect(()=>createClient({baseUrl:url,token:'synthetic',fetch:transport})).toThrow(ResearchAgentError)
  expect(transport).not.toHaveBeenCalled()
})
it('composes caller cancellation with the request deadline', async () => {
  vi.useFakeTimers()
  vi.spyOn(AbortSignal,'timeout').mockImplementation(ms=>{const controller=new AbortController();setTimeout(()=>controller.abort(),ms);return controller.signal})
  const caller=new AbortController()
  let combined: AbortSignal | null | undefined
  const client=createClient({baseUrl:'https://fixture.invalid',fetch:async(_url,init)=>{
    combined=init?.signal
    return new Promise((_resolve,reject)=>combined?.addEventListener('abort',()=>reject(combined?.reason),{once:true}))
  }})
  try {
    const task=client.ask('synthetic',{budget:0,signal:caller.signal})
    const assertion=expect(task).rejects.toMatchObject({code:'deadline'})
    await vi.advanceTimersByTimeAsync(15001)
    await assertion
    expect(combined).not.toBe(caller.signal)
    expect(caller.signal.aborted).toBe(false)
  } finally {vi.restoreAllMocks();vi.useRealTimers()}
})

import express from 'express'
import { once } from 'node:events'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { createMcpServer } from '../mcp/tools.js'
it('maps HTTP errors through MCP structured content for all policy/recovery categories', async () => {
  let code: Parameters<typeof errorEnvelope>[0]='paused'
  const app=express();app.get('/api/mcp/status',(_req,res)=>res.status(503).json(errorEnvelope(code,503,'retained')))
  const http=app.listen(0,'127.0.0.1');await once(http,'listening')
  const server=createMcpServer(`http://127.0.0.1:${(http.address() as {port:number}).port}`)
  const client=new Client({name:'synthetic-errors',version:'1'})
  const [a,b]=InMemoryTransport.createLinkedPair()
  try {
    await server.connect(a);await client.connect(b)
    for(code of ['cap_zero','paused','budget_exhausted','per_call_cap','overloaded','deadline','settlement_pending','unauthorized','backend_unavailable'] as const){
      const response=await client.callTool({name:'wallet_status',arguments:{}})
      expect(response.isError).toBe(true)
      expect(response.structuredContent).toMatchObject({code,status:503,runId:'retained'})
    }
  } finally {await client.close();await server.close();http.closeAllConnections();await new Promise<void>(done=>http.close(()=>done()))}
})
