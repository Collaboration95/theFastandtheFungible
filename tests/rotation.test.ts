import {expect,it,vi} from 'vitest'
import {Client,Wallet,decode} from 'xrpl'
import {rotateOperatorKey,type RotationSubmission} from '../publisher/publishing/rotate-operator.js'
function fixture(){
 const master=Wallet.generate(),next=Wallet.generate();let regular:string|undefined
 const request=vi.fn(async(r:{command:string;transaction?:string})=>r.command==='server_info'?{result:{info:{network_id:1}}}:r.command==='tx'?{result:{validated:true,hash:r.transaction,meta:{TransactionResult:'tesSUCCESS'},ledger_index:90}}:{result:{account_data:{RegularKey:regular}}})
 const autofill=vi.fn(async(tx:object)=>({...tx,Sequence:1,Fee:'12',LastLedgerSequence:100}))
 const submitAndWait=vi.fn(async(blob:string)=>{regular=String(decode(blob).RegularKey);return {result:{validated:true,meta:{TransactionResult:'tesSUCCESS'},ledger_index:90}}})
 const client={request,autofill,submitAndWait}as unknown as Client
 return {master,next,request,autofill,submitAndWait,client}
}
it('persists the exact signed rotation before broadcast and resumes that blob without signing again',async()=>{
 const f=fixture();let saved:RotationSubmission|undefined
 f.submitAndWait.mockImplementationOnce(async()=>{throw Error('lost response')})
 await expect(rotateOperatorKey(f.client,f.master.classicAddress,f.master,f.next,{persist:s=>{saved=s}})).rejects.toThrow('lost response')
 expect(saved).toBeDefined();expect(f.submitAndWait).toHaveBeenCalledWith(saved!.txBlob)
 const result=await rotateOperatorKey(f.client,f.master.classicAddress,f.master,f.next,{saved})
 expect(f.autofill).toHaveBeenCalledTimes(1);expect(result.hash).toBe(saved!.hash);expect(f.submitAndWait.mock.calls.map(c=>c[0])).toEqual([saved!.txBlob,saved!.txBlob])
})
it('refuses a non-Testnet node and a modified saved rotation before broadcasting',async()=>{
 const f=fixture();f.request.mockResolvedValueOnce({result:{info:{network_id:0}}} as never)
 await expect(rotateOperatorKey(f.client,f.master.classicAddress,f.master,f.next)).rejects.toThrow('Testnet')
 expect(f.submitAndWait).not.toHaveBeenCalled()
 let saved:RotationSubmission|undefined
 await rotateOperatorKey(f.client,f.master.classicAddress,f.master,f.next,{persist:s=>{saved=s}})
 await expect(rotateOperatorKey(f.client,f.master.classicAddress,f.master,f.next,{saved:{...saved!,hash:'A'.repeat(64)}})).rejects.toThrow('binding')
 expect(f.submitAndWait).toHaveBeenCalledTimes(1)
})

it('recognizes the saved validated rotation on resume without another submit',async()=>{
 const f=fixture();let saved:RotationSubmission|undefined
 const first=await rotateOperatorKey(f.client,f.master.classicAddress,f.master,f.next,{persist:s=>{saved=s}})
 const resumed=await rotateOperatorKey(f.client,f.master.classicAddress,f.master,f.next,{saved})
 expect(resumed).toEqual(first);expect(f.autofill).toHaveBeenCalledTimes(1);expect(f.submitAndWait).toHaveBeenCalledTimes(1)
})
