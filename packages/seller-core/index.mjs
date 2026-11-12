import assert from 'node:assert/strict'
import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'
import {chmodSync} from 'node:fs'
import {decode,hashes} from 'xrpl'
import {jsonCanonicalStringify} from 'x402-xrpl'
const hex=b=>b.toString('hex').toUpperCase(), bytes=h=>Buffer.from(h,'hex')
const sha=b=>hex(createHash('sha256').update(b).digest())
export const conditionFor=key=>`A0258020${sha(key)}810120`
export const commitment=offer=>sha(jsonCanonicalStringify(offer))
export const encodeHeader=value=>Buffer.from(JSON.stringify(value)).toString('base64')
export function decodeHeader(value){assert.equal(typeof value,'string');assert(value.length<=32768);return JSON.parse(Buffer.from(value,'base64').toString('utf8'))}
export function seal(content){
  const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv)
  const encrypted=Buffer.concat([cipher.update(content),cipher.final()])
  return {key,envelope:{ciphertext:hex(encrypted),iv:hex(iv),tag:hex(cipher.getAuthTag()),plaintextHash:sha(content)}}
}
export function open(envelope,finish,condition){
  assert.match(finish.Fulfillment,/^A0228020[A-F0-9]{64}$/)
  const key=bytes(finish.Fulfillment.slice(8));assert.equal(conditionFor(key),condition);assert.equal(finish.Condition,condition)
  const cipher=createDecipheriv('aes-256-gcm',key,bytes(envelope.iv));cipher.setAuthTag(bytes(envelope.tag))
  const plaintext=Buffer.concat([cipher.update(bytes(envelope.ciphertext)),cipher.final()]);assert.equal(sha(plaintext),envelope.plaintextHash)
  return plaintext
}
export function checkCreate(tx,offer){
  const req=offer.accepts[0],e=req.extra
  assert.equal(tx.TransactionType,'EscrowCreate');assert.equal(tx.Account,e.buyer);assert.equal(tx.Destination,req.payTo)
  assert.equal(tx.Amount,req.amount);assert.equal(tx.Condition,e.condition);assert.equal(tx.CancelAfter,e.cancelAfter)
  for(const field of ['FinishAfter','DestinationTag','SourceTag','TicketSequence','NetworkID'])assert.equal(tx[field],undefined)
  assert(tx.Flags===undefined||tx.Flags===0||tx.Flags===0x80000000)
  assert(Number.isSafeInteger(tx.Sequence)&&tx.Sequence>0)
  assert.deepEqual(tx.Memos,[{Memo:{MemoData:commitment(offer)}}])
}
function validated(result){assert.equal(result.validated,true);assert.equal(result.meta.TransactionResult,'tesSUCCESS');return result.tx_json??result}
/** A single process owns this DB and seller wallet. Persist before signing/submission; retries reuse the original blob. */
export function createSeller({client,wallet,dbPath,resourceUrl,content,amountDrops='1000',maxOffers=1000,timeoutSeconds=60,withhold=false}){
  assert.match(amountDrops,/^[1-9][0-9]*$/);assert(BigInt(amountDrops)<=1000000n)
  assert(timeoutSeconds>=24&&timeoutSeconds<=300);assert(dbPath)
  const resource=new URL(resourceUrl);assert(resource.protocol==='https:'||(resource.protocol==='http:'&&['127.0.0.1','localhost'].includes(resource.hostname)))
  const db=new DatabaseSync(dbPath);if(dbPath!==':memory:')chmodSync(dbPath,0o600)
  db.exec('PRAGMA journal_mode=DELETE; CREATE TABLE IF NOT EXISTS offers (id TEXT PRIMARY KEY, state TEXT NOT NULL)')
  const read=id=>{const r=db.prepare('SELECT state FROM offers WHERE id=?').get(id);return r&&JSON.parse(r.state)}
  const save=(id,state)=>db.prepare('INSERT OR REPLACE INTO offers VALUES (?,?)').run(id,JSON.stringify(state))
  let signing=Promise.resolve();const active=new Map()
  const ready=client.request({command:'server_info'}).then(r=>assert.equal(r.result.info.network_id,1,'XRPL Testnet required'))
  void ready.catch(()=>{})
  const reply=(status,body,headers={})=>({status,body,headers:{'Cache-Control':'no-store',...headers}})
  async function handle({buyer,intent,paymentSignature}){
    try{
      await ready
      assert.match(buyer,/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/);assert.match(intent,/^[A-Za-z0-9_-]{1,128}$/)
      const id=`${buyer}:${intent}`
      let state=read(id)
      if(!state){
        assert(!paymentSignature,'Unknown invoice; obtain original offer first')
        assert(db.prepare('SELECT count(*) AS n FROM offers').get().n<maxOffers,'Offer capacity reached')
        const now=(await client.request({command:'ledger',ledger_index:'validated'})).result.ledger.close_time
        // Recheck after async work so simultaneous challenges cannot rotate the key for one intent.
        state=read(id)
        if(!state){
          const sealed=seal(Buffer.from(await content(intent))),old=read(id)
          if(old)state=old
          else{
            assert(db.prepare('SELECT count(*) AS n FROM offers').get().n<maxOffers,'Offer capacity reached')
            const offer={x402Version:2,resource:{url:resourceUrl},accepts:[{scheme:'key-reveal-escrow',network:'xrpl:1',asset:'XRP',amount:amountDrops,payTo:wallet.classicAddress,maxTimeoutSeconds:timeoutSeconds,extra:{invoiceId:randomUUID(),buyer,condition:conditionFor(sealed.key),cancelAfter:now+timeoutSeconds}}],extensions:{keyReveal:sealed.envelope}}
            state={key:hex(sealed.key),offer};save(id,state)
          }
        }
      }
      if(!paymentSignature)return reply(402,state.offer,{'PAYMENT-REQUIRED':encodeHeader(state.offer)})
      const payment=decodeHeader(paymentSignature);assert.equal(payment.x402Version,2);assert.deepEqual(payment.accepted,state.offer.accepts[0])
      const blob=payment.payload.signedTxBlob;assert.match(blob,/^[A-Fa-f0-9]+$/)
      const hash=hashes.hashSignedTx(blob).toUpperCase(),tx=decode(blob);checkCreate(tx,state.offer)
      if(state.createHash)assert.equal(hash,state.createHash,'No replacement create')
      const create=(await client.request({command:'tx',transaction:hash})).result
      assert.equal(create.hash.toUpperCase(),hash);checkCreate(validated(create),state.offer)
      state=read(id)
      if(state.createHash)assert.equal(hash,state.createHash)
      state.createHash=hash;save(id,state)
      if(withhold)return reply(202,{status:'key withheld; cancel after expiry',createHash:hash})
      if(!active.has(id)){
        const task=signing.then(async()=>{
          state=read(id)
          if(!state.finish){
            // An uncertain finish still owns its wallet sequence. Resolve that
            // original invoice before another intent may allocate a signature.
            assert(!db.prepare("SELECT id FROM offers WHERE id<>? AND json_extract(state,'$.finish') IS NOT NULL AND COALESCE(json_extract(state,'$.done'),0)=0 LIMIT 1").get(id),'Reconcile the original pending finish first')
            const node=(await client.request({command:'ledger_entry',ledger_index:'validated',escrow:{owner:buyer,seq:tx.Sequence}})).result.node
            for(const field of ['Account','Destination','Amount','Condition','CancelAfter'])assert.equal(node[field],tx[field])
            const headroom=async()=>assert(node.CancelAfter-(await client.request({command:'ledger',ledger_index:'validated'})).result.ledger.close_time>8,'Too little time to reveal safely')
            await headroom()
            const prepared=await client.autofill({TransactionType:'EscrowFinish',Account:wallet.classicAddress,Owner:buyer,OfferSequence:tx.Sequence,Condition:node.Condition,Fulfillment:`A0228020${state.key}`})
            assert(BigInt(prepared.Fee)<=1000n,'Fee cap exceeded')
            await headroom()
            const signed=wallet.sign(prepared)
            state.finish={blob:signed.tx_blob,hash:signed.hash};save(id,state)
          }
          if(!state.done){
            // Same signed blob on recovery. Never simulate a transaction containing the key.
            let finish=await client.request({command:'tx',transaction:state.finish.hash}).then(r=>r.result).catch(()=>undefined)
            if(!finish?.validated)finish=(await client.submitAndWait(state.finish.blob)).result
            const ft=validated(finish);assert.equal(ft.TransactionType,'EscrowFinish');assert.equal(ft.Owner,buyer);assert.equal(ft.OfferSequence,tx.Sequence)
            assert.equal(ft.Condition,tx.Condition);assert.equal(ft.Fulfillment,`A0228020${state.key}`)
            state.done=true;save(id,state)
          }
          return {finishHash:state.finish.hash,createHash:hash}
        })
        signing=task.then(()=>{},()=>{});active.set(id,task);void task.finally(()=>active.delete(id)).catch(()=>{})
      }
      const result=await active.get(id)
      return reply(200,result,{'PAYMENT-RESPONSE':encodeHeader({success:true,transaction:result.finishHash,network:'xrpl:1',payer:buyer})})
    }catch{return reply(400,{error:'Escrow offer or validated transaction rejected; retry original intent and blob only'})}
  }
  return {handle,close:()=>db.close()}
}
