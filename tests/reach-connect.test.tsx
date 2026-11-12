// @vitest-environment jsdom
import { afterEach,expect,it,vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import AgentConnect from '../src/components/AgentConnect'
import {installLinks} from '../src/agent-install'
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
afterEach(()=>vi.unstubAllGlobals())
it('encodes actual URL in both client install protocols',()=>{
 const url='https://research.example/mcp',links=installLinks(url)
 const cursor=new URL(links.cursor)
 expect(JSON.parse(atob(cursor.searchParams.get('config')!))).toEqual({url})
 expect(cursor.searchParams.get('name')).toBe('researchagent')
 const vscode=new URL(links.vscode)
 expect(JSON.parse(decodeURIComponent(vscode.search.slice(1)))).toEqual({name:'researchagent',type:'http',url})
 expect(links.claude).toBe("claude mcp add --transport http researchagent 'https://research.example/mcp'")
})
it('loads server config, exposes all client choices and copies the URL',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({url:'https://research.example/mcp'})}))
 const writeText=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}})
 const node=document.createElement('div'),root=createRoot(node);document.body.append(node)
 try{
  await act(async()=>root.render(<AgentConnect/>))
  expect(node.textContent).toContain('Settings → Connectors');expect(node.textContent).toContain('Add custom connector');expect(node.textContent).toContain('choose No sign in')
  expect([...node.querySelectorAll('a')].map(a=>a.textContent)).toEqual(['Add to Cursor','Add to VS Code'])
  const button=[...node.querySelectorAll('button')].find(b=>b.textContent==='Copy URL')!
  await act(async()=>button.click());expect(writeText).toHaveBeenCalledWith('https://research.example/mcp')
 }finally{await act(async()=>root.unmount());node.remove()}
})
it('reports disabled URL access without advertising a non-working install',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({url:null})}))
 const node=document.createElement('div'),root=createRoot(node)
 try{await act(async()=>root.render(<AgentConnect/>));expect(node.querySelector('a')).toBeNull();expect(node.textContent).toContain('not enabled')}
 finally{await act(async()=>root.unmount())}
})

it('derives hosted URLs only when opted in and keeps local bearer requirements behind a relay',async()=>{
 const {connectionDetails}=await import('../mcp/connect.js')
 const hosted={HOSTED:'1',HOSTED_ORIGIN:'https://research.example',MCP_PUBLIC:'off'} as import('../server/config.js').Config
 expect(connectionDetails(hosted)).toEqual({url:null})
 expect(connectionDetails({...hosted,MCP_PUBLIC:'on'})).toEqual({url:'https://research.example/mcp',requiresBearer:false})
 expect(connectionDetails({...hosted,HOSTED:'0',MCP_CONNECT_URL:'https://local-relay.example/mcp'})).toEqual({url:'https://local-relay.example/mcp',requiresBearer:true})
 expect(connectionDetails({...hosted,MCP_CONNECT_URL:'https://user:password@research.example/mcp'})).toEqual({url:null})
})

it('explains the remote Claude boundary without suggesting no-auth for a local bearer server',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({url:'http://127.0.0.1:9689/mcp',requiresBearer:true})}))
 const node=document.createElement('div'),root=createRoot(node)
 try{
  await act(async()=>root.render(<AgentConnect/>))
  expect(node.textContent).toContain('URL reachable from the internet')
  expect(node.textContent).toContain('requires an agent bearer key')
  expect(node.textContent).not.toContain('choose No sign in')
  expect(node.textContent).toContain("claude mcp add --transport http researchagent 'http://127.0.0.1:9689/mcp'")
 }finally{await act(async()=>root.unmount())}
})
