// Read-only ledger checks plus a local policy refusal. No payment or credential transaction.
import {readFileSync,writeFileSync,statSync} from 'node:fs'
import {Wallet} from 'xrpl'
import {Store} from '../../server/store.js'
import {PublisherClient} from '../../server/publisher-client.js'
import {PurchaseManager} from '../../server/purchases.js'
import {signManifest} from '../../shared/manifest.js'
import {regulatedBuyerRefusal} from './regulated.js'
import type {PublicCandidate} from '../../shared/contracts/index.js'
if(!process.argv.includes('--testnet'))throw Error('Requires --testnet')
const file=process.env.WRITER_PRIVATE_FILE
if(!file||(statSync(file).mode&0o777)!==0o600)throw Error('WRITER_PRIVATE_FILE must be a private 0600 key file')
const proofFile=process.env.REGULATED_PROOF_FILE??'docs/evidence/publish/regulated-testnet.json',proof=JSON.parse(readFileSync(proofFile,'utf8'))
const wallet=Wallet.fromSeed(JSON.parse(readFileSync(file,'utf8')).seed)
if(wallet.classicAddress!==proof.writer)throw Error('Evidence writer mismatch')
process.env.REGULATED_MODE='on';process.env.WRITER_CREDENTIAL_DOMAIN=proof.domain
const manifest=signManifest({schemaVersion:2,publisherSlug:'credential-proof',articleId:'note',version:'1',wallet:wallet.classicAddress,pubKey:wallet.publicKey,priceMinor:10,root:'B'.repeat(64),leaves:['B'.repeat(64)],claims:[],wordCount:200,publishedAt:new Date().toISOString(),relevance:0.8},wallet.privateKey)
const candidate={profileId:'credential-proof',resourceId:'note',version:'1',tier:'PAID',wallet:wallet.classicAddress,price:{amountMinor:10,currency:'SGD'},manifest}as PublicCandidate
const store=new Store(':memory:'),client=new PublisherClient()
let quoteRequests=0
client.paidGet=async()=>{quoteRequests++;throw Error('Refused policy must not request a quote')}
try{
 const run=store.createRun('Read-only credential refusal proof',100)
 const result=await new PurchaseManager(store,client).purchase({runId:run.runId,candidate,intentId:'revoked-writer'})
 const buyerReason=await regulatedBuyerRefusal(proof.buyer,{PUBLISHER_REGULATED_MODE:'on',WRITER_CREDENTIAL_DOMAIN:proof.domain})
 const audit=store.auditEntries().filter(e=>e.kind==='refusal')
 const snapshot=store.getRun(run.runId)
 if(result.status!=='SKIPPED'||snapshot.spentMinor!==0||snapshot.grants.length||quoteRequests||!buyerReason||!audit.length||!store.auditVerify().ok)throw Error('Refusal evidence failed')
 proof.refusals={observedAt:new Date().toISOString(),label:'Fresh HTTP Testnet credential reads; local purchase policy and publisher buyer guard; no transaction submitted',writer:{status:result.status,reason:result.error,spentMinor:snapshot.spentMinor,grants:snapshot.grants.length,quoteRequests,auditEvents:audit.length,auditChainValid:true},buyer:{reason:buyerReason}}
 writeFileSync(proofFile,JSON.stringify(proof,null,2)+'\n')
 console.log(JSON.stringify(proof.refusals))
}finally{store.close()}
