// Separate fresh Testnet accounts; never operates on hosted accounts.
import {Client,Wallet,type SubmittableTransaction,type SetRegularKey} from 'xrpl'
import {writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {ResourceScope} from '../../shared/resource-scope.js'
import {testnetUrl} from '../../shared/xrpl.js'
import {fundTestnetWallet} from '../../publisher/publishing/testnet-funding.js'
import {WriterCredentials} from '../../server/writer-credentials.js'
import {rotateOperatorKey} from './rotate-operator.js'
if(!process.argv.includes('--testnet'))throw Error('Requires --testnet')
const scope=new ResourceScope(),root=scope.evidenceDir('publish-regulated-','Private operator credential and rotation keys; Testnet only'),client=new Client(testnetUrl(),{timeout:15000,connectionTimeout:10000})
const issuer=Wallet.generate(),writer=Wallet.generate(),buyer=Wallet.generate(),regular=Wallet.generate(),replacement=Wallet.generate()
for(const [name,wallet]of Object.entries({issuer,writer,buyer,regular,replacement}))writeFileSync(join(root,`${name}.json`),JSON.stringify({seed:wallet.seed}),{mode:0o600})
const transactions:Record<string,unknown>[]=[]
async function submit(wallet:Wallet,tx:Record<string,unknown>){const prepared=await client.autofill({...tx,Account:wallet.classicAddress}as SubmittableTransaction);if(Number(prepared.Fee)>2000)throw Error('Fee cap');const signed=wallet.sign(prepared);const r=await client.submitAndWait(signed.tx_blob);if(!r.result.validated||typeof r.result.meta!=='object'||r.result.meta.TransactionResult!=='tesSUCCESS')throw Error('Testnet proof transaction failed');transactions.push({type:tx.TransactionType,hash:signed.hash,ledgerIndex:r.result.ledger_index});console.log(JSON.stringify({type:tx.TransactionType,hash:signed.hash}));return r}
try{
 await fundTestnetWallet(issuer);await client.connect();if((await client.request({command:'server_info'})).result.info.network_id!==1)throw Error('Testnet required')
 for(const w of [writer,buyer])await submit(issuer,{TransactionType:'Payment',Destination:w.classicAddress,Amount:'6000000'})
 const type=Buffer.from('researchagent/writer-v1').toString('hex').toUpperCase()
 const domainTx=await submit(issuer,{TransactionType:'PermissionedDomainSet',AcceptedCredentials:[{Credential:{Issuer:issuer.classicAddress,CredentialType:type}}]})
 const meta=domainTx.result.meta as {AffectedNodes:{CreatedNode?:{LedgerEntryType:string;LedgerIndex:string}}[]};const domain=meta.AffectedNodes.find(n=>n.CreatedNode?.LedgerEntryType==='PermissionedDomain')!.CreatedNode!.LedgerIndex
 const rpc=async(request:Record<string,unknown>)=>{try{return await client.request(request as never)}catch(e){const error=(e as {data?:{error:string}}).data?.error;if(error==='entryNotFound')return {result:{error}};throw Error('Credential RPC failed')}}
 async function check(subject:string){const verifier=new WriterCredentials([],rpc,8000,1000,domain);try{return await verifier.current(subject)}finally{verifier.dispose()}}
 const missing=await check(writer.classicAddress)
 await submit(issuer,{TransactionType:'CredentialCreate',Subject:writer.classicAddress,CredentialType:type});const unaccepted=await check(writer.classicAddress)
 await submit(writer,{TransactionType:'CredentialAccept',Issuer:issuer.classicAddress,CredentialType:type});const accepted=await check(writer.classicAddress)
 await submit(issuer,{TransactionType:'CredentialDelete',Subject:writer.classicAddress,CredentialType:type});const revoked=await check(writer.classicAddress)
 const buyerMissing=await check(buyer.classicAddress)
 const rotations=[];rotations.push(await rotateOperatorKey(client,issuer.classicAddress,issuer,regular));rotations.push(await rotateOperatorKey(client,issuer.classicAddress,regular,replacement))
 const staleTx=await client.autofill<SetRegularKey>({TransactionType:'SetRegularKey',Account:issuer.classicAddress,RegularKey:regular.classicAddress})
 if(Number(staleTx.Fee)>2000)throw Error('Fee cap')
 const staleSigned=regular.sign(staleTx),staleResult=await client.submit(staleSigned.tx_blob)
 const staleKeyRefused=staleResult.result.engine_result==='tefBAD_AUTH'
 const staleKeyRefusal={hash:staleSigned.hash,code:staleResult.result.engine_result,validated:false}

 if(missing.status!=='unverified'||unaccepted.status!=='unverified'||accepted.status!=='verified'||revoked.status!=='unverified'||!staleKeyRefused)throw Error('Credential or rotation observations mismatch')
 const proof={label:'Fresh local XRPL Testnet credential lifecycle and regular-key rotation; no hosted or mainnet operation',observedAt:new Date().toISOString(),domain,issuer:issuer.classicAddress,writer:writer.classicAddress,buyer:buyer.classicAddress,missing,unaccepted,accepted,revoked,buyerMissing,transactions,rotations,staleKeyRefused,staleKeyRefusal}
 writeFileSync('docs/evidence/publish/regulated-testnet.json',JSON.stringify(proof,null,2)+'\n');console.log('Credential lifecycle and rotation passed')
}finally{await client.disconnect();await scope.close()}
