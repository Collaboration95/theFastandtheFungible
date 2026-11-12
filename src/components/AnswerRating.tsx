import { useEffect, useState } from 'react'
import { getAnswerRating, rateAnswer } from '../api'
import { money } from '../../shared/presentation'
export default function AnswerRating({runId,amountMinor}:{runId:string;amountMinor:number}) {
  const [vote,setVote]=useState<boolean|null>(), [sending,setSending]=useState(false), [failed,setFailed]=useState(false)
  useEffect(()=>{const controller=new AbortController();void getAnswerRating(runId,controller.signal).then(r=>setVote(r.yes)).catch(()=>{});return()=>controller.abort()},[runId])
  if(vote===undefined)return null
  const choose=async(yes:boolean)=>{if(sending)return;setSending(true);setFailed(false);try{setVote((await rateAnswer(runId,yes)).yes)}catch{setFailed(true)}finally{setSending(false)}}
  return <div className="ra-answer-rating" aria-label="Answer value">{vote===null?<><span>Worth {money(amountMinor)}?</span> <button disabled={sending} onClick={()=>void choose(true)}>Yes</button> <button disabled={sending} onClick={()=>void choose(false)}>No</button></>:<span>Thanks for your feedback.</span>}{failed&&<span role="status"> Couldn’t save your vote. Please try again.</span>}</div>
}
