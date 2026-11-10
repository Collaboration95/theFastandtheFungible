import { expect,it,vi } from 'vitest'
const mocks=vi.hoisted(()=>({http:vi.fn(),connect:vi.fn(),close:vi.fn()}))
vi.mock('dotenv',()=>({default:{config:()=>{}}}))
vi.mock('../server/engine.js',()=>({startEngine:async()=>({apiUrl:'http://127.0.0.1:1',close:mocks.close})}))
vi.mock('../server/store.js',()=>({Store:class {close(){}}}))
vi.mock('../mcp/tools.js',()=>({createMcpServer:()=>({server:{},connect:mocks.connect,close:async()=>{}})}))
vi.mock('../mcp/http.js',()=>({startMcpHttp:mocks.http}))
it.each(['http','--http'])('A17 %s dispatches the same protected HTTP host',async command=>{
 const args=process.argv, before=process.listeners('SIGTERM'), ints=process.listeners('SIGINT')
 mocks.http.mockResolvedValue({url:'http://127.0.0.1:1/mcp',close:async()=>{}})
 vi.spyOn(console,'error').mockImplementation(()=>{})
 vi.stubEnv('RA_BACKEND_URL',''); vi.stubEnv('RA_DATA_DIR','/tmp/hm-dispatch-no-files')
 try {
  vi.resetModules(); process.argv=[args[0],'mcp/server.ts',command,'--port','0']
  await import('../mcp/server.js')
  expect(mocks.http).toHaveBeenCalledWith(expect.objectContaining({port:0}))
  expect(mocks.connect).not.toHaveBeenCalled()
 } finally {process.argv=args; for(const listener of process.listeners('SIGTERM'))if(!before.includes(listener))process.removeListener('SIGTERM',listener);for(const listener of process.listeners('SIGINT'))if(!ints.includes(listener))process.removeListener('SIGINT',listener);vi.restoreAllMocks();vi.unstubAllEnvs();vi.clearAllMocks()}
})
