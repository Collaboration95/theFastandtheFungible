import { expect, it } from 'vitest'
import { boundedBody } from '../server/body-limit.js'
it('cancels an oversize stream without Content-Length', async () => {
  let cancelled = false
  const response = new Response(new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(100)) }, cancel() { cancelled = true } }))
  await expect(boundedBody(response, 256)).rejects.toThrow('byte limit')
  expect(cancelled).toBe(true)
})
it('keeps a body exactly at the limit', async () => { expect((await boundedBody(new Response('abcd'),4)).toString()).toBe('abcd') })

import express from 'express'
import { once } from 'node:events'
import { get } from 'node:http'
import { runsRouter } from '../server/api/runs.js'
import type { ApiContext } from '../server/api/context.js'
import { exampleRun } from '../shared/contracts/examples.js'
it('removes all subscription keys after 1,000 disconnects', async () => {
  const streams: ApiContext['streams'] = new Map()
  const context = { streams, store: {getRun: () => exampleRun} } as unknown as ApiContext
  const app=express();app.use(runsRouter(context))
  const server=app.listen(0,'127.0.0.1');await once(server,'listening')
  try {
    const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/runs/example-run/events`
    for(let n=0;n<1000;n++) await new Promise<void>((resolve,reject)=> {
      const req=get(url,res=>{res.once('data',()=>{res.destroy();req.destroy();resolve()})});req.on('error',reject)
    })
    await new Promise(resolve=>setTimeout(resolve,20))
    expect(streams.size).toBe(0)
  } finally {server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()))}
},15000)
