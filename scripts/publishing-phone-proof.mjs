// Opt-in local phone acceptance: real Testnet faucet, no hosted deployment.
import {createServer as viteServer} from 'vite'
import {createServer as netServer} from 'node:net'
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs'
import {randomBytes} from 'node:crypto'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {ResourceScope} from '../shared/resource-scope.ts'
import {createPublisherApp} from '../publisher/routes.ts'
import {publishingGateway} from '../publisher/publishing/gateway.ts'
import {Store} from '../server/store.ts'
import express from 'express'
import {Wallet} from 'xrpl'
import {PublisherClient} from '../server/publisher-client.ts'
import {PurchaseManager} from '../server/purchases.ts'
import {XrplPayer} from '../server/xrpl.ts'
import {testnetLedger} from '../shared/xrpl.ts'
import {fundTestnetWallet} from '../publisher/publishing/testnet-funding.ts'
import {retrieve} from '../server/agents/research.ts'
if(!process.argv.includes('--testnet'))throw Error('Requires --testnet')
const ledger=testnetLedger()
const scope=new ResourceScope(),root=scope.evidenceDir('web-phone-','Private Testnet payout keys and publishing journal'),store=new Store(':memory:')
const env={WEB_PUBLISHING:'on',SETTLEMENT_RAIL:'xrpl-testnet',OPERATOR_TOKEN:randomBytes(32).toString('hex'),AUTO_APPROVE:'on',AUTO_APPROVE_SECONDS:'5',ESCROW_MODE:'key-reveal'}
const pub=createPublisherApp({writers:{publishers:[],writers:[],articles:[]},rail:'xrpl-testnet',journal:join(root,'publisher.db'),env})
async function listen(app){const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.listening?r():server.once('listening',r));scope.defer(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))});return `http://127.0.0.1:${server.address().port}`}
mkdirSync('scratch',{recursive:true});writeFileSync('scratch/publish-phone-entry.tsx',`import '@fontsource-variable/geist';import '../src/styles.css';import '../src/phone-targets.css';import React from 'react';import {createRoot} from 'react-dom/client';import Form from '../src/components/WebPublishing';createRoot(document.getElementById('root')!).render(<Form/>);`,{flag:'wx'})
scope.defer(()=>rmSync('scratch/publish-phone-entry.tsx'))
let vite,browser
try{await pub.locals.ready;const publisher=await listen(pub),api=express();api.use(publishingGateway({...env,PUBLISHER_URL:publisher},store));const backend=await listen(api)
 const socket=netServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r))
 vite=await viteServer({server:{host:'127.0.0.1',port,strictPort:true,proxy:{'/api':backend}},plugins:[{name:'phone-test',configureServer(server){server.middlewares.use(async(req,res,next)=>{if(req.url!=='/publish-probe')return next();res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/publish-probe','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main style="padding:16px;box-sizing:border-box"><div id="root"></div></main><script type="module" src="/scratch/publish-phone-entry.tsx"></script></body></html>'))})}}]});await vite.listen()
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:375,height:812}});await page.goto(`http://127.0.0.1:${port}/publish-probe`)
 const body=readFileSync('tests/web-publishing.test.ts','utf8').match(/body:\[([\s\S]+?)\]\.join/)[1].split('\n').map(s=>s.trim()).filter(s=>s.startsWith("'")).map(s=>s.replace(/^'|',?$/g,'')).join('\n\n')
 await page.getByLabel('Title',{exact:true}).fill('Ledger reserve checklist');await page.getByLabel('Note (Markdown)').fill(body);await page.getByLabel('Topics (separated by commas)').fill('reserve, escrow');await page.getByLabel('Display name (optional)').fill('Phone acceptance probe')
 const started=performance.now();await page.getByText('Submit for review',{exact:true}).click();await page.getByRole('heading',{name:'Live',exact:true}).waitFor({timeout:90000});const seconds=(performance.now()-started)/1000,overflow=await page.evaluate(()=>document.documentElement.scrollWidth>375)
 if(overflow)throw Error('Phone overflow')
 const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('ra-publishing')))
 const status=await(await fetch(backend+`/api/publishing/notes/${id.id}`,{headers:{'X-Publishing-Key':id.key}})).json()
 process.env.ESCROW_MODE='key-reveal';process.env.SETTLEMENT_RAIL='xrpl-testnet'
 const buyer=Wallet.generate();writeFileSync(join(root,'buyer.private.json'),JSON.stringify({seed:buyer.seed}),{mode:0o600});await fundTestnetWallet(buyer)
 const client=new PublisherClient({baseUrl:publisher}),candidate=(await retrieve(client,'ledger reserve escrow')).candidates.find(c=>c.profileId===status.slug)
 if(!candidate)throw Error('New phone note not searchable')
 const run=store.createRun('Check ledger reserve before escrow',100),manager=new PurchaseManager(store,client,new XrplPayer(ledger,buyer))
 let intent=await manager.purchase({runId:run.runId,candidate,intentId:`phone-${run.runId}`})
 const until=Date.now()+60000;while(intent.status==='SUBMITTING'&&Date.now()<until){await manager.reconcile();intent=store.getIntent(intent.intentId)}
 if(intent.status!=='VERIFIED')throw Error('Phone note purchase did not verify')
 await page.getByText(/Bought 1 times, earned S\$0.10/).waitFor({timeout:10000});await page.screenshot({path:'docs/evidence/publish/phone-live-375.png',fullPage:true})
 const proof={totalToVisibleSaleSeconds:(performance.now()-started)/1000,transactions:{create:intent.escrow?.createHash,finish:intent.escrow?.finishHash},label:'Local Chromium 375 px scripted form, real gateway, moderation, fresh Testnet payout account and live registry; no human typing or hosted deployment measured',width:375,overflow,submitToVisibleLiveSeconds:seconds,serverSeconds:status.secondsToLive,address:status.address,bought:1,earnedMinor:intent.amountMinor}
 writeFileSync('docs/evidence/publish/phone-live.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof))
}finally{await browser?.close();await vite?.close();await scope.close();await pub.locals.closePublishing();pub.locals.journal.close();await pub.locals.ledger?.close?.();store.close();await ledger.close()}
