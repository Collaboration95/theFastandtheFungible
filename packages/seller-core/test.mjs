import assert from 'node:assert/strict'
import {test} from 'node:test'
import {Wallet,decode} from 'xrpl'
import {seal,open,conditionFor,commitment,checkCreate,createSeller,encodeHeader} from './index.mjs'
test('no plaintext before the committed key, tamper fails closed',()=>{
 const {key,envelope}=seal(Buffer.from('paid bytes')),condition=conditionFor(key),finish={Condition:condition,Fulfillment:`A0228020${key.toString('hex').toUpperCase()}`}
 assert(!JSON.stringify(envelope).includes('paid bytes'));assert.equal(open(envelope,finish,condition).toString(),'paid bytes')
 for(const e of [{...envelope,tag:'00'.repeat(16)},{...envelope,plaintextHash:'00'.repeat(32)}])assert.throws(()=>open(e,finish,condition))
 assert.throws(()=>open(envelope,{...finish,Fulfillment:`A0228020${'00'.repeat(32)}`},condition))
})
test('one validated create, one persisted finish, no HTTP key; invalid offers cannot settle',async()=>{
 const buyer=Wallet.generate(),wallet=Wallet.generate();let creates,createHash,submits=0
 const client={request:async r=>({result:r.command==='server_info'?{info:{network_id:1}}:r.command==='ledger'?{ledger:{close_time:100}}:r.command==='tx'?(r.transaction===createHash?{...creates,hash:r.transaction,validated:true,meta:{TransactionResult:'tesSUCCESS'}}:{}):{node:creates}}),autofill:async tx=>({...tx,Sequence:1,Fee:'423',LastLedgerSequence:30}),submitAndWait:async blob=>{submits++;return{result:{tx_json:decode(blob),validated:true,meta:{TransactionResult:'tesSUCCESS'}}}}}
 const seller=createSeller({client,wallet,dbPath:':memory:',resourceUrl:'http://localhost/article',content:()=> 'paid bytes'})
 try{
  const args={buyer:buyer.classicAddress,intent:'once'},challenge=await seller.handle(args)
  assert.equal(challenge.status,402);const offer=challenge.body,req=offer.accepts[0]
  creates={TransactionType:'EscrowCreate',Account:args.buyer,Destination:wallet.classicAddress,Amount:'1000',Condition:req.extra.condition,CancelAfter:160,Sequence:1,Fee:'12',LastLedgerSequence:20,Memos:[{Memo:{MemoData:commitment(offer)}}]}
  checkCreate(creates,offer)
  for(const patch of [{Amount:'1001'},{FinishAfter:110},{DestinationTag:3},{NetworkID:0},{Condition:'BAD'},{Memos:[]}])assert.throws(()=>checkCreate({...creates,...patch},offer))
  const signed=buyer.sign(creates);createHash=signed.hash;const blob=signed.tx_blob,paymentSignature=encodeHeader({x402Version:2,accepted:req,payload:{signedTxBlob:blob}})
  const results=await Promise.all([seller.handle({...args,paymentSignature}),seller.handle({...args,paymentSignature})]);assert(results.every(r=>r.status===200));assert.equal(submits,1)
  assert.deepEqual(await seller.handle({...args,paymentSignature}),results[0]);assert.equal(submits,1)
  assert(!JSON.stringify(results[0]).includes('Fulfillment'));assert(!JSON.stringify(results[0]).includes('paid bytes'))
  assert.equal((await seller.handle({...args,paymentSignature:encodeHeader({x402Version:2,accepted:{...req,amount:'1'},payload:{signedTxBlob:blob}})})).status,400)
 }finally{seller.close()}
})
test('restart resolves a lost finish response from its recorded hash, without another submission',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path')
 const dir=mkdtempSync(join(tmpdir(),'seller-restart-')),buyer=Wallet.generate(),wallet=Wallet.generate()
 let createHash,create,finished,submits=0
 const client={request:async r=>({result:r.command==='server_info'?{info:{network_id:1}}:r.command==='ledger'?{ledger:{close_time:100}}:r.command==='tx'?(r.transaction===createHash?{...create,hash:r.transaction,validated:true,meta:{TransactionResult:'tesSUCCESS'}}:finished??{}):{node:create}}),autofill:async tx=>({...tx,Sequence:1,Fee:'423',LastLedgerSequence:30}),submitAndWait:async blob=>{submits++;finished={tx_json:decode(blob),validated:true,meta:{TransactionResult:'tesSUCCESS'}};throw Error('Response lost after validation')}}
 const options={client,wallet,dbPath:join(dir,'seller.db'),resourceUrl:'http://localhost/article',content:()=> 'paid secret'},args={buyer:buyer.classicAddress,intent:'recovery'}
 let seller=createSeller(options)
 try{
  const offer=(await seller.handle(args)).body,req=offer.accepts[0],e=req.extra
  create={TransactionType:'EscrowCreate',Account:args.buyer,Destination:req.payTo,Amount:req.amount,Condition:e.condition,CancelAfter:e.cancelAfter,Sequence:1,Fee:'12',Memos:[{Memo:{MemoData:commitment(offer)}}]}
  const signed=buyer.sign(create);createHash=signed.hash
  const paymentSignature=encodeHeader({x402Version:2,accepted:req,payload:{signedTxBlob:signed.tx_blob}})
  assert.equal((await seller.handle({...args,paymentSignature})).status,400);assert.equal(submits,1)
  seller.close();seller=createSeller(options)
  assert.equal((await seller.handle({...args,paymentSignature})).status,200);assert.equal(submits,1)
 }finally{seller.close();rmSync(dir,{recursive:true,force:true})}
})

test('concurrent new intents cannot overfill the durable offer journal',async()=>{
 const buyer=Wallet.generate(),wallet=Wallet.generate()
 const client={request:async r=>({result:r.command==='server_info'?{info:{network_id:1}}:{ledger:{close_time:100}}})}
 const seller=createSeller({client,wallet,dbPath:':memory:',resourceUrl:'http://localhost/article',content:async()=> 'bounded article',maxOffers:1})
 try{
  const replies=await Promise.all(['first','second'].map(intent=>seller.handle({buyer:buyer.classicAddress,intent})))
  assert.deepEqual(replies.map(r=>r.status).sort(),[400,402])
  const original=replies.find(r=>r.status===402).body
  const intent=replies[0].status===402?'first':'second'
  assert.deepEqual((await seller.handle({buyer:buyer.classicAddress,intent})).body,original)
 }finally{seller.close()}
})

test('the wallet cannot sign another invoice while a finish outcome is uncertain',async()=>{
 const buyer=Wallet.generate(),wallet=Wallet.generate(),creates=new Map();let fills=0,submits=0
 const client={request:async r=>({result:r.command==='server_info'?{info:{network_id:1}}:r.command==='ledger'?{ledger:{close_time:100}}:r.command==='tx'?(creates.get(r.transaction)??{}):{node:[...creates.values()].find(tx=>tx.Sequence===r.escrow.seq)}}),autofill:async tx=>{fills++;return{...tx,Sequence:1,Fee:'423',LastLedgerSequence:30}},submitAndWait:async()=>{submits++;throw Error('Unknown finish outcome')}}
 const seller=createSeller({client,wallet,dbPath:':memory:',resourceUrl:'http://localhost/article',content:()=> 'paid article'})
 try{
  for(const [i,intent] of ['first','second'].entries()){
   const args={buyer:buyer.classicAddress,intent},offer=(await seller.handle(args)).body,req=offer.accepts[0],e=req.extra
   const tx={TransactionType:'EscrowCreate',Account:args.buyer,Destination:req.payTo,Amount:req.amount,Condition:e.condition,CancelAfter:e.cancelAfter,Sequence:i+1,Fee:'12',Memos:[{Memo:{MemoData:commitment(offer)}}]}
   const signed=buyer.sign(tx);creates.set(signed.hash,{...tx,hash:signed.hash,validated:true,meta:{TransactionResult:'tesSUCCESS'}})
   const paymentSignature=encodeHeader({x402Version:2,accepted:req,payload:{signedTxBlob:signed.tx_blob}})
   assert.equal((await seller.handle({...args,paymentSignature})).status,400)
  }
  assert.equal(fills,1,'An uncertain finish must keep exclusive wallet sequence ownership')
  assert.equal(submits,1)
 }finally{seller.close()}
})

test('a near-expiry escrow cannot authorize a fresh key-bearing finish',async()=>{
 for(const duringAutofill of [false,true]){
  const buyer=Wallet.generate(),wallet=Wallet.generate();let now=100,create,createHash,fills=0,signs=0
  const sign=wallet.sign.bind(wallet);wallet.sign=tx=>{signs++;return sign(tx)}
  const client={request:async r=>({result:r.command==='server_info'?{info:{network_id:1}}:r.command==='ledger'?{ledger:{close_time:now}}:r.command==='tx'?{...create,hash:createHash,validated:true,meta:{TransactionResult:'tesSUCCESS'}}:{node:create}}),autofill:async tx=>{fills++;now=159;return{...tx,Sequence:1,Fee:'423',LastLedgerSequence:30}}}
  const seller=createSeller({client,wallet,dbPath:':memory:',resourceUrl:'http://localhost/article',content:()=> 'paid article'}),args={buyer:buyer.classicAddress,intent:'late'}
  try{
   const offer=(await seller.handle(args)).body,req=offer.accepts[0],e=req.extra
   create={TransactionType:'EscrowCreate',Account:args.buyer,Destination:req.payTo,Amount:req.amount,Condition:e.condition,CancelAfter:e.cancelAfter,Sequence:1,Fee:'12',Memos:[{Memo:{MemoData:commitment(offer)}}]}
   const signed=buyer.sign(create);createHash=signed.hash;if(!duringAutofill)now=e.cancelAfter-1
   const paymentSignature=encodeHeader({x402Version:2,accepted:req,payload:{signedTxBlob:signed.tx_blob}})
   assert.equal((await seller.handle({...args,paymentSignature})).status,400)
   assert.equal(fills,duringAutofill?1:0);assert.equal(signs,0,'Refuse before signing a key-bearing transaction')
  }finally{seller.close()}
 }
})
