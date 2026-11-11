// Synthetic metadata only: no ledger transactions, money, model calls or private content.
import { createHash } from 'node:crypto'
import type { Store } from '../../server/store.js'
import { XRPL_LABEL } from '../../shared/contracts/index.js'
import { SCOREBOARD_SINCE } from '../../server/hosted/stats.js'
export function seedSandbox(store: Store, count = 4) {
  const base = store.createRun('PRIVATE_QUESTION_SENTINEL',200,{ research:'fixture',decision:'fixture',publisher:'local',settlement:XRPL_LABEL })
  store.hostedState(db => {
    db.prepare('DELETE FROM runs WHERE id=?').run(base.runId)
    const run = db.prepare('INSERT INTO runs VALUES (?,?)'), intent = db.prepare('INSERT INTO intents VALUES (?,?,?)'), receipt = db.prepare('INSERT INTO receipts VALUES (?,?,?)')
    const event = db.prepare('INSERT INTO events (run_id,json) VALUES (?,?)'), decision = db.prepare('INSERT INTO decisions VALUES (?,?,?)')
    const hold = db.prepare(`INSERT INTO hosted_holds (id,principal,request_key,question,ip,day,created,minor,model_used,run_id,state) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    const attempt = db.prepare(`INSERT INTO hosted_attempts (hold_id,provider,model,reserved,input_tokens,output_tokens,created) VALUES (?,'fixture','synthetic',?,0,0,?)`)
    for (let n=0;n<count;n++) {
      const id = `synthetic-${n}`, k = n%4, paid = k<2, amount = k===0 ? 40 : 60, started = SCOREBOARD_SINCE + 3600000 + n, intentId = `intent-${n}`
      const anchor = { version:'anchor-v1',network:'xrpl:1',txHash:'A'.repeat(64),account:'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',head:'b'.repeat(64),runIdHash:createHash('sha256').update(id).digest('hex'),ledgerIndex:1,feeDrops:'12' }
      run.run(id,JSON.stringify({...base,runId:id,phase:'DONE',spentMinor:paid?amount:0,ledgerAnchor:anchor}))
      hold.run(id,'synthetic-principal',id,'PRIVATE_HASH_SENTINEL','PRIVATE_IP_SENTINEL','2026-11-11',started,200,(k+1)*2000,id,'done')
      attempt.run(id,(k+1)*2000,started)
      const events: {type:string;data?:Record<string,unknown>}[] = [{type:'SEARCH'}]
      if (paid) {
        const i = {intentId,runId:id,profileId:'synthetic',resourceId:'article',version:'1',amountMinor:amount,status:k===1?'REFUNDED':'VERIFIED',...(k===1?{refund:{amountMinor:amount,txHash:'synthetic-refund'}}:{})}
        intent.run(intentId,id,JSON.stringify(i)); receipt.run(intentId,JSON.stringify({intentId,runId:id,amountMinor:amount,receiptId:`receipt-${n}`}), 'PRIVATE_TOKEN_SENTINEL')
        decision.run(id,1,JSON.stringify({round:1,selectedResourceId:'article',rows:[{verdict:'BUY',candidate:{resourceId:'article',version:'1'}}]}))
        events.push({type:'DECIDE'},{type:'BUY'},{type:'PURCHASE',data:{intentId}},{type:'GRANT',data:{intentId}},{type:'READ_PAID'})
      }
      events.push({type:'DONE'})
      for (const [index,e] of events.entries()) event.run(id,JSON.stringify({...e,runId:id,label:'synthetic',at:new Date(started+(index===events.length-1?(k+1)*10000:index)).toISOString()}))
    }
  })
}
