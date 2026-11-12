// Installs packed local packages in an isolated consumer. Testnet I/O: do not hold the heavy lock.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {writeFileSync,copyFileSync,readFileSync,rmSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolve,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {once} from 'node:events'
import {Client,Wallet} from 'xrpl'
import {register} from 'tsx/esm/api'
register()
const {ResourceScope}=await import('../../shared/resource-scope.ts')
assert.equal(process.env.XRPL_KEY_REVEAL_TESTNET,'1','Opt in: XRPL_KEY_REVEAL_TESTNET=1')
const scope=new ResourceScope()
const root=fileURLToPath(new URL('../..',import.meta.url)),dir=scope.evidenceDir('ra-reach-acceptance-','Original Testnet wallet and signed payment recovery state; delete only after validated finish/cancel reconciliation')
const run=(cmd,args,cwd=dir)=>execFileSync(cmd,args,{cwd,stdio:'pipe',maxBuffer:8*1024*1024})
const evidence=resolve(process.env.REACH_EVIDENCE||join(root,'docs/evidence/reach/testnet-acceptance.json'))
const python=process.env.REACH_PYTHON||'python3'
let server,client,succeeded=false
try{
  writeFileSync(evidence,JSON.stringify({kind:'real-testnet-python-httpx-to-installed-seller-hono',complete:false,transactions:[],startedAt:new Date().toISOString()},null,2)+'\n')
  writeFileSync(join(dir,'package.json'),JSON.stringify({private:true,type:'module'}))
  const archives=[]
  for(const name of ['seller-core','seller-hono']){
    const out=JSON.parse(run('npm',['pack',join(root,'packages',name),'--json']))
    archives.push(join(dir,out[0].filename))
  }
  run('npm',['install','--no-audit','--no-fund',...archives,'hono','@hono/node-server','xrpl@4.7.0'])
  copyFileSync(join(root,'scripts/reach/seller.mjs'),join(dir,'seller.mjs'))
  // The Python environment is installed separately: pip install httpx xrpl-py cryptography.
  copyFileSync(join(root,'scripts/reach/buyer.py'),join(dir,'buyer.py'))
  client=new Client('wss://s.altnet.rippletest.net:51233');await client.connect()
  assert.equal((await client.request({command:'server_info'})).result.info.network_id,1)
  const saved=process.env.REACH_WALLETS_FILE ? JSON.parse(readFileSync(process.env.REACH_WALLETS_FILE,'utf8')) : undefined
  const seller=saved ? Wallet.fromSeed(saved.sellerSeed) : (await client.fundWallet()).wallet
  const buyer=saved ? Wallet.fromSeed(saved.buyerSeed) : (await client.fundWallet()).wallet
  const config={sellerSeed:seller.seed,buyerSeed:buyer.seed,sellerAddress:seller.classicAddress,directory:dir,evidence}
  const file=join(dir,'private-config.json');writeFileSync(file,JSON.stringify(config),{mode:0o600})
  server=scope.spawn(process.execPath,[join(dir,'seller.mjs'),file],{cwd:dir});server.stdin.end();server.stderr.resume()
  const url=await new Promise((done,fail)=>{
    let text='';const timer=setTimeout(()=>fail(Error('Packaged seller startup timeout')),30000)
    server.stdout.on('data',chunk=>{text+=chunk;try{const line=JSON.parse(text.trim());clearTimeout(timer);done(line.url)}catch{/* incomplete line */}})
    server.once('exit',()=>{clearTimeout(timer);fail(Error('Packaged seller exited before listening'))})
  })
  writeFileSync(file,JSON.stringify({...config,url}),{mode:0o600})
  const child=scope.spawn(python,[join(dir,'buyer.py'),file],{cwd:dir});child.stdin.end();child.stderr.resume();child.stdout.pipe(process.stdout,{end:false})
  assert.equal((await once(child,'exit'))[0],0,'Buyer failed; inspect original recorded transactions, never automatically re-pay')
  const result=JSON.parse(readFileSync(evidence,'utf8'));assert.equal(result.complete,true)
  result.at=new Date().toISOString();result.node=process.version
  result.packageArchives=archives.map(path=>({name:path.split('/').pop(),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))
  writeFileSync(evidence,JSON.stringify(result,null,2)+'\n')
  succeeded=true
}finally{
  let closed=false
  try{await scope.close();await client?.disconnect();closed=true}
  finally{
    if(succeeded&&closed)rmSync(dir,{recursive:true,force:true})
    else console.log(`Private recovery state retained with restrictive permissions: ${dir}`)
  }
}
