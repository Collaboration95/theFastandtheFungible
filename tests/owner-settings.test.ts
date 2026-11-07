import { resources } from './helpers/resource-scope.js'
import { it, expect } from 'vitest'
import express from 'express'
import { once } from 'node:events'
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ownerSettingsRouter } from '../server/owner-settings'
import { Store } from '../server/store'
import type { ApiContext } from '../server/api/context'
import { applyOwnerConfig } from '../server/owner-config'

it('requires local browser metadata and CSRF, masks secrets, audits caps and applies only after restart', async () => {
  const dir = resources().tempDir('ra-owner-')
  const old = {...process.env}
  writeFileSync(join(dir,'.env'), 'LLM_PROVIDER=fixture\n', {mode:0o600})
  Object.assign(process.env,{DOTENV_CONFIG_PATH:join(dir,'.env'),RA_DATA_DIR:dir,RA_WEB_ORIGIN:'http://127.0.0.1:12345',DEEPSEEK_API_KEY:'synthetic-secret-never-returned'})
  const store = resources().own(new Store(join(dir,'app.db')))
  const app=express(); app.use(express.json()); app.use((req,res,next)=>{ if(req.get('X-Test-Agent')) res.locals.agent={id:'synthetic-agent'}; next() }); app.use(ownerSettingsRouter({store} as ApiContext))
  const server=app.listen(0,'127.0.0.1'); await once(server,'listening')
  const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/settings`
  const headers={'Origin':'http://127.0.0.1:12345','Sec-Fetch-Site':'same-origin','Content-Type':'application/json'}
  try {
    for(const h of [{}, {Authorization:'Bearer agent'}, {...headers,Origin:'https://remote.invalid'}, {...headers,'Sec-Fetch-Site':'cross-site'}]) expect((await fetch(url,{headers:h as Record<string,string>})).status).toBe(403)
    const r=await fetch(url,{headers}); const raw=await r.text(); expect(raw).not.toContain('synthetic-secret-never-returned'); const state=JSON.parse(raw)
    expect((await fetch(url,{headers:{...headers,'X-Test-Agent':'1'}})).status).toBe(403)
    for (const path of ['', '/key', '/prompt-budget']) {
      for (const denied of [{}, {...headers, Origin:'https://remote.invalid'}]) expect((await fetch(url+path,{method:'POST',headers:denied,body:'{}'})).status).toBe(403)
    }
    const body=JSON.stringify({...state.values,MCP_MAX_BUDGET_MINOR:123})
    expect((await fetch(url,{method:'POST',headers,body})).status).toBe(403)
    expect((await fetch(url,{method:'POST',headers:{...headers,'X-Settings-CSRF':state.csrf},body})).status).toBe(200)
    expect(store.auditEntries().some(e=>e.principal==='human' && e.data.action==='settings-save')).toBe(true)
    expect(JSON.stringify(store.auditEntries())).not.toContain('synthetic-secret-never-returned')
    const keyResponse = await fetch(url+'/key', {method:'POST',headers:{...headers,'X-Settings-CSRF':state.csrf},body:JSON.stringify({account:'OPENAI_API_KEY',value:'synthetic-replacement-key'})}); expect(keyResponse.status).toBe(200); expect(await keyResponse.text()).not.toContain('synthetic-replacement-key'); expect(readFileSync(join(dir,'.env'),'utf8')).toContain('OPENAI_API_KEY='); expect(JSON.stringify(store.auditEntries())).not.toContain('synthetic-replacement-key')
    const env={RA_DATA_DIR:dir}; applyOwnerConfig(env); expect((env as NodeJS.ProcessEnv).MCP_MAX_BUDGET_MINOR).toBe('123')
    for (const extra of [{key:'secret'}, {network:'mainnet'}, {MCP_MAX_BUDGET_MINOR:999999}]) expect((await fetch(url,{method:'POST',headers:{...headers,'X-Settings-CSRF':state.csrf},body:JSON.stringify({...state.values,...extra})})).status).toBe(400)
  } finally { server.closeAllConnections(); await new Promise<void>(r=>server.close(()=>r())); store.close(); process.env=old }
})
