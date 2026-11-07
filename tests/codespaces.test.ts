import { resources } from './helpers/resource-scope.js'
import { request } from 'node:http'
import { expect, it } from 'vitest'
import { rmSync } from 'node:fs'
import { startFixture } from '../.devcontainer/start.js'
it('accepts the exact forwarded Codespaces origin and rejects other hosts/origins', async () => {
  const saved = { ...process.env }, dir = resources().tempDir('codespace-')
  const fixture = await startFixture({webPort:0,apiPort:0,publisherPort:0,dataDir:dir,codespace:'fixture-space',domain:'app.github.dev'})
  try {
    const address = fixture.web.httpServer!.address() as {port:number}
    const url = `http://127.0.0.1:${address.port}`
    const call = (path: string, headers: Record<string,string>, body?: string) => new Promise<number>((resolve,reject) => {
      const req = request(url+path,{method:body?'POST':'GET',headers},res => {res.resume();res.once('end',()=>resolve(res.statusCode!))});req.once('error',reject);req.end(body)
    })
    const headers = {Host:fixture.forwardedHost!, Origin:`https://${fixture.forwardedHost}`}
    expect(await call('/', headers)).toBe(200)
    expect(await call('/', {...headers,Origin:'https://other.example'})).toBe(403)
    expect(await call('/', {Host:'other.example'})).toBe(403)
    const status = await call('/runs', {...headers,'Content-Type':'application/json'},JSON.stringify({question:'What did the BoJ change?',budgetMinor:0}))
    expect(status).toBeLessThan(300)
  } finally {
    await fixture.close(); rmSync(dir,{recursive:true,force:true})
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
    Object.assign(process.env,saved)
  }
},30000)
