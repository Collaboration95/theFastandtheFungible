// Operator-only Testnet rotation. Seeds and the retry blob stay in private files.
import { readFileSync, writeFileSync, statSync, openSync, fsyncSync, closeSync, renameSync, rmSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { Client, Wallet, decode, hashes, type SetRegularKey } from 'xrpl'
import { testnetUrl } from '../../shared/xrpl.js'
export type RotationSubmission={txBlob:string;hash:string;lastLedger:number}
export async function rotateOperatorKey(client:Client,account:string,signer:Wallet,next:Wallet,options:{saved?:RotationSubmission;persist?:(submission:RotationSubmission)=>void}={}) {
  if((await client.request({command:'server_info'})).result.info.network_id!==1)throw Error('Testnet network ID required')
  const info=await client.request({command:'account_info',account,ledger_index:'validated'})
  let submission=options.saved
  if(submission){
    const tx=decode(submission.txBlob)
    if(hashes.hashSignedTx(submission.txBlob)!==submission.hash||tx.TransactionType!=='SetRegularKey'||tx.Account!==account||tx.RegularKey!==next.classicAddress||tx.LastLedgerSequence!==submission.lastLedger||!/^\d+$/.test(String(tx.Fee))||Number(tx.Fee)>2000)throw Error('Saved rotation binding rejected')
  }else if(info.result.account_data.RegularKey===next.classicAddress)return {account,regularKey:next.classicAddress,alreadySet:true}
  if(submission&&info.result.account_data.RegularKey===next.classicAddress){
    const prior=await client.request({command:'tx',transaction:submission.hash,binary:false})
    if(!prior.result.validated||prior.result.hash!==submission.hash||typeof prior.result.meta!=='object'||prior.result.meta.TransactionResult!=='tesSUCCESS')throw Error('Rotation proof unavailable; reconcile before retrying')
    return {account,regularKey:next.classicAddress,hash:submission.hash,ledgerIndex:prior.result.ledger_index}
  }
  if(!submission){
    const tx=await client.autofill<SetRegularKey>({TransactionType:'SetRegularKey',Account:account,RegularKey:next.classicAddress})
    if(!/^\d+$/.test(String(tx.Fee))||Number(tx.Fee)>2000)throw Error('Rotation fee exceeds ceiling')
    const signed=signer.sign(tx)
    submission={txBlob:signed.tx_blob,hash:signed.hash,lastLedger:tx.LastLedgerSequence!}
    options.persist?.(submission) // Durable before any broadcast, including an uncertain response.
  }
  const result=await client.submitAndWait(submission.txBlob)
  if(!result.result.validated||typeof result.result.meta!=='object'||result.result.meta.TransactionResult!=='tesSUCCESS')throw Error('Rotation did not validate')
  const after=await client.request({command:'account_info',account,ledger_index:'validated'})
  if(after.result.account_data.RegularKey!==next.classicAddress)throw Error('Rotation not observed')
  return {account,regularKey:next.classicAddress,hash:submission.hash,ledgerIndex:result.result.ledger_index}
}
const privateFile=(file:string)=>{if((statSync(file).mode&0o777)!==0o600)throw Error('Private file must have mode 0600');return JSON.parse(readFileSync(file,'utf8'))}
function savePrivate(file:string,record:unknown,replace=false) {
  const target=replace?file+'.pending-'+randomUUID():file
  try {const fd=openSync(target,'wx',0o600);try{writeFileSync(fd,JSON.stringify(record));fsyncSync(fd)}finally{closeSync(fd)};if(replace)renameSync(target,file)}finally{if(replace)rmSync(target,{force:true})}
}
async function main() {
  if(!process.argv.includes('--testnet'))throw Error('Requires --testnet')
  const account=process.env.ROTATION_ACCOUNT,file=process.env.ROTATION_SIGNER_FILE,output=process.env.ROTATION_NEXT_FILE
  if(!account||!file||!output)throw Error('Set ROTATION_ACCOUNT, ROTATION_SIGNER_FILE and ROTATION_NEXT_FILE')
  const signer=Wallet.fromSeed(privateFile(file).seed,{masterAddress:account}),resume=process.argv.includes('--resume'),record=resume?privateFile(output):{seed:Wallet.generate().seed}
  const next=Wallet.fromSeed(record.seed)
  if(!resume)savePrivate(output,record)
  const client=new Client(testnetUrl(),{timeout:15000,connectionTimeout:10000})
  try {await client.connect();console.log(JSON.stringify(await rotateOperatorKey(client,account,signer,next,{saved:record.submission,persist:submission=>savePrivate(output,{...record,submission},true)})))}finally{await client.disconnect()}
}
if(process.argv[1]?.endsWith('rotate-operator.ts'))void main().catch(()=>{console.error('Testnet rotation failed; retain both private files. Reconcile account_info and resume the same saved submission with --resume.');process.exitCode=1})
