// Deterministic, zero-model authoring using the existing bank loader and fact matcher.
// Retains 100 historical non-protocol questions as explicitly out-of-profile controls.
import 'dotenv/config'
import {createHash} from 'node:crypto'
import {writeFileSync} from 'node:fs'
import {loadBank,holds} from '../eval/questions/bank.js'
import {loadWriterCorpus} from '../publisher/corpus.js'
const corpus=await loadWriterCorpus(undefined,{allowMini:false})
if(process.env.CORPUS_PROFILE!=='real'||process.env.FREE_TIER!=='public-docs')throw Error('Generate only against the real public-docs profile')
const controls=loadBank().questions.slice(0,100).map(q=>({...q,stratum:'historical-out-of-profile'}))
const specs:[string,string][]=[
 ['AccountSet','Which XRPL transaction changes account options?'],
 ['TrustSet','Which XRPL transaction creates or modifies a trust line?'],
 ['AccountDelete','Which XRPL transaction deletes an account and sends its remaining XRP?'],
 ['CheckCreate','Which XRPL transaction creates a check?'],
 ['CheckCash','Which XRPL transaction redeems a check?'],
 ['CheckCancel','Which XRPL transaction cancels a check?'],
 ['DepositPreauth','Which XRPL transaction preauthorizes deposits?'],
 ['EscrowCreate','Which XRPL transaction places funds in escrow?'],
 ['EscrowFinish','Which XRPL transaction delivers an escrowed payment?'],
 ['EscrowCancel','Which XRPL transaction cancels an expired escrow?'],
 ['NFTokenMint','Which XRPL transaction creates a non-fungible token?'],
 ['NFTokenBurn','Which XRPL transaction destroys a non-fungible token?'],
 ['NFTokenCreateOffer','Which XRPL transaction creates an offer to buy or sell an NFT?'],
 ['NFTokenAcceptOffer','Which XRPL transaction accepts an offer to buy or sell an NFT?'],
 ['NFTokenCancelOffer','Which XRPL transaction cancels NFT offers?'],
 ['OfferCancel','Which XRPL transaction removes an order from the decentralized exchange?'],
 ['PaymentChannelCreate','Which XRPL transaction opens a payment channel?'],
 ['PaymentChannelFund','Which XRPL transaction adds XRP to a payment channel?'],
 ['PaymentChannelClaim','Which XRPL transaction claims funds from a payment channel?'],
 ['SetRegularKey','Which XRPL transaction assigns a regular key to an account?'],
 ['TicketCreate','Which XRPL transaction sets aside sequence numbers for future use?'],
 ['AMMDeposit','Which XRPL transaction adds assets to an automated market maker pool?'],
 ['AMMWithdraw','Which XRPL transaction removes assets from an automated market maker pool?'],
 ['AMMVote','Which XRPL transaction votes on an automated market maker trading fee?'],
 ['AMMBid','Which XRPL transaction bids for an automated market maker auction slot?'],
 ['AMMDelete','Which XRPL transaction removes an empty automated market maker?'],
 ['CredentialCreate','Which XRPL transaction issues an on-ledger credential?'],
 ['CredentialDelete','Which XRPL transaction deletes an on-ledger credential?'],
 ['DIDDelete','Which XRPL transaction removes an account decentralized identifier?'],
 ['PermissionedDomainDelete','Which XRPL transaction deletes a permissioned domain?'],
 ['account_info','Which XRPL API method returns an account balance and activity summary?'],
 ['account_lines','Which XRPL API method lists an account trust lines?'],
 ['account_objects','Which XRPL API method lists ledger objects owned by an account?'],
 ['account_tx','Which XRPL API method lists transactions involving an account?'],
 ['account_currencies','Which XRPL API method lists currencies an account can send or receive?'],
 ['gateway_balances','Which XRPL API method totals balances of tokens issued by an account?'],
 ['ledger_data','Which XRPL API method retrieves raw ledger state objects?'],
 ['server_info','Which XRPL API method returns human-readable server status?'],
 ['book_offers','Which XRPL API method retrieves offers from an order book?'],
 ['ripple_path_find','Which XRPL API method finds payment paths between two accounts?'],
]
// Import the previously used judge banks as development data, without claiming a new holdout.
const {readFileSync}=await import('node:fs')
const judge=['v3','v4','v5'].flatMap(v=>JSON.parse(readFileSync(`eval/questions/judge-xrpl.${v}.json`,'utf8')).questions.map((q:{id:string;question:string;gold:string})=>({...q,id:`${v}-${q.id}`,stratum:'protocol-used-judge-bank'})))
if(judge.length!==60)throw Error('Expected 60 existing judge questions')
const extra=specs.map(([gold,question],i)=>{
 const source=corpus.articles.find(a=>a.tier==='FREE'&&a.publisherSlug==='xrpl-docs'&&a.passages.some(p=>holds([gold],p.text)))
 if(!source)throw Error(`No real source for ${gold}`)
 return {id:`R${String(i+1).padStart(2,'0')}`,question,gold,sources:[source.articleId],stratum:'protocol-source-facts'}
})
const questions=[...controls,...judge,...extra]
if(questions.length!==200||new Set(questions.map(q=>q.id)).size!==200)throw Error('Invalid paired bank')
const payload={schema:'researchagent.r3-bank/v1',method:'100 historical synthetic-fact controls, whose sources are excluded by the real profile; 60 used protocol judge questions; 40 offline protocol specifications checked in real public docs. Development diagnostic, no independent holdout claim. Report each stratum separately.',questions}
const bytes=JSON.stringify(payload,null,2)+'\n',file='eval/questions/r3-real.v1.json'
writeFileSync(file,bytes)
console.log(JSON.stringify({file,questions:200,protocolQuestions:100,sha256:createHash('sha256').update(bytes).digest('hex')}))
