// Copied into the isolated consumer directory by acceptance.mjs; package imports only.
import {once} from 'node:events'
import {readFileSync} from 'node:fs'
import {Hono} from 'hono'
import {serve} from '@hono/node-server'
import {keyReveal} from '@researchagent/seller-hono'
import {Client,Wallet} from 'xrpl'
const config=JSON.parse(readFileSync(process.argv[2],'utf8'))
const client=new Client('wss://s.altnet.rippletest.net:51233');await client.connect()
const wallet=Wallet.fromSeed(config.sellerSeed),app=new Hono(),server=serve({fetch:app.fetch,hostname:'127.0.0.1',port:0})
if(!server.listening)await once(server,'listening')
const base=`http://127.0.0.1:${server.address().port}`
const sellers=[]
for(const [path,withhold] of [['/article',false],['/withhold',true]]){
 const seller=keyReveal({client,wallet,dbPath:config.directory+path+'.db',resourceUrl:base+path,content:()=> 'Synthetic package acceptance article: key revealed on XRPL Testnet.',timeoutSeconds:withhold?24:60,withhold})
 sellers.push(seller);app.get(path,seller.middleware)
}
console.log(JSON.stringify({url:base}))
async function close(){server.closeAllConnections();await new Promise(r=>server.close(r));for(const s of sellers)s.close();await client.disconnect()}
process.once('SIGTERM',()=>void close());process.once('SIGINT',()=>void close())
