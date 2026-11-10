// Operator only. All seeds are persisted before any connection/faucet use.
import { readdirSync, mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync, statSync, openSync, fsyncSync, closeSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { Client, Wallet } from 'xrpl'
import { testnetUrl } from '../shared/xrpl.js'
import { seedEnvName } from '../publisher/registry.js'
const paidSlugs = () => readdirSync(new URL('../data/writers/',import.meta.url)).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(new URL('../data/writers/'+f,import.meta.url),'utf8')).publisher).filter(p=>Object.values(p.prices||{}).some(n=>Number(n)>0)).map(p=>p.slug as string).sort()
const args=process.argv.slice(2)
const out=args[args.indexOf('--out')+1]
if(!args.includes('--out')||!out||!args.includes('--testnet')) throw Error('Use --testnet --out PRIVATE_DIRECTORY [--fund] [--dry-run]')
if(args.some(a=>a.startsWith('--')&&!['--out','--testnet','--fund','--dry-run'].includes(a))) throw Error('Unknown wallet option')
const url=testnetUrl()
const dir=resolve(out)
const root=resolve('.')
if(dir.startsWith(root+'/')||dir===root) throw Error('Wallet files must stay outside the repository')
const names=['XRPL_PAYER_SEED',...paidSlugs().map(seedEnvName)]
if(args.includes('--dry-run')) {
  for(const name of names) console.log(`gcloud secrets create ra-${name.toLowerCase().replaceAll('_','-')}-RELEASE --replication-policy=automatic --data-file=${join(dir,name)}`)
  console.log('planned: persist seeds, connect to allowlisted Testnet, read balances; at most one faucet call per unfunded wallet with --fund')
  process.exit(0)
}
process.umask(0o077)
mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700)
const wallets=names.map(name=>{
  const file=join(dir,name)
  if(existsSync(file) && (statSync(file).mode&0o077)!==0) throw Error('Private wallet file permissions must be 0600')
  const wallet=existsSync(file)?Wallet.fromSeed(readFileSync(file,'utf8').trim()):Wallet.generate()
  if(!existsSync(file)) {writeFileSync(file,wallet.seed!,{mode:0o600,flag:'wx'});const fd=openSync(file,'r');fsyncSync(fd);closeSync(fd)}
  writeFileSync(join(dir,name.replace(/SEED$/,'ADDRESS')),wallet.classicAddress,{mode:0o600})
  return {name,wallet}
})
const directoryFd=openSync(dir,'r');fsyncSync(directoryFd);closeSync(directoryFd)
const client=new Client(url,{connectionTimeout:15000,timeout:20000})
const publicRows: {name:string;address:string;balanceXrp:string;funding:string}[]=[]
try {
  await client.connect()
  const info=await client.request({command:'server_info'})
  if(Number(info.result.info.network_id)!==1) throw Error('Server did not confirm XRPL Testnet network_id=1')
  for(const {name,wallet} of wallets) {
    let balance='0'
    try {balance=String(await client.getXrpBalance(wallet.classicAddress))} catch(e) {if((e as {data?:{error?:string}}).data?.error!=='actNotFound') throw Error('Balance lookup unavailable')}
    let funding='unchanged'
    if(Number(balance)<20 && args.includes('--fund')) {
      // Durable attempt marker prevents a retry from looping on an uncertain faucet.
      const marker=join(dir,`${name}.faucet-attempt`)
      if(existsSync(marker)) funding='previous-attempt-check-manually'
      else {writeFileSync(marker,new Date().toISOString(),{flag:'wx',mode:0o600});const fd=openSync(marker,'r');fsyncSync(fd);closeSync(fd);syncDirectory(dir);await client.fundWallet(wallet);funding='one-attempt';balance=String(await client.getXrpBalance(wallet.classicAddress))}
    }
    publicRows.push({name,address:wallet.classicAddress,balanceXrp:balance,funding})
  }
  writeFileSync(join(dir,'public.json'),JSON.stringify({network:'xrpl-testnet',at:new Date().toISOString(),wallets:publicRows},null,2),{mode:0o600})
  console.log(JSON.stringify(publicRows))
} catch {console.error('Hosted wallet provisioning stopped; saved identities and faucet markers retained. Check Testnet privately.');process.exitCode=1}
finally {await client.disconnect()}
function syncDirectory(path:string) { const fd=openSync(path,'r');fsyncSync(fd);closeSync(fd) }
