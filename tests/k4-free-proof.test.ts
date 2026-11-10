import { afterEach, expect, it, vi } from 'vitest'
import { deriveAddress, deriveKeypair, generateSeed } from 'ripple-keypairs'
import { PublisherClient } from '../server/publisher-client.js'
import { leafHash, manifestRoot, signManifest } from '../shared/manifest.js'
import { countWords } from '../shared/contracts/writers.js'
import { SearchHitSchema } from '../shared/contracts/manifest.js'
const keys=deriveKeypair(generateSeed({algorithm:'ed25519'})), wallet=deriveAddress(keys.publicKey)
const body='The free evidence is authentic.', passages=[{id:'p1',text:body}], salts=['abcd']
const leaves=passages.map((p,i)=>leafHash(salts[i],i,p.id,p.text))
const unsigned={publisherSlug:'writer',articleId:'free',version:'v1',wallet,pubKey:keys.publicKey,priceMinor:0,leaves,root:manifestRoot(leaves),claims:[],wordCount:countWords(body),publishedAt:'2026-11-10',relevance:1}
const hit=()=>SearchHitSchema.parse({publisherSlug:'writer',writerSlug:'writer',articleId:'free',version:'v1',title:'Free evidence',tier:'FREE',url:'/w/writer/articles/free',abstract:'Evidence',tags:['evidence'],priceMinor:0,relevance:1,family:'evidence',publishedAt:'2026-11-10',searchMode:'keyword'})
afterEach(()=>vi.unstubAllGlobals())
it.each(['honest','changed passage','salts','word count','version','wallet','bad signature','unsigned legacy','unsigned federated'])('checks full free proof before accepting identity: %s',async fault=>{
 const article={publisherSlug:'writer',articleId:'free',version:'v1',title:'Free evidence',tier:'FREE',body,passages:structuredClone(passages),verification:{manifest:signManifest({...unsigned,...(fault==='word count'?{wordCount:100}:{}),...(fault==='version'?{version:'v2'}:{})},keys.privateKey),salts:[...salts]}}
 if(fault==='changed passage') {article.body='The free evidence was forged.';article.passages[0].text=article.body}
 if(fault==='salts') article.verification.salts=['dcba']
 if(fault==='bad signature') article.verification.manifest.sig='AB'.repeat(64)
 const envelope: { verification?: typeof article.verification } = article
 if(fault.startsWith('unsigned')) delete envelope.verification
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>Response.json(url.includes('/registry')?{publishers:[{slug:'writer',name:'Writer',kind:'independent',wallet:fault==='wallet'?'wrong':wallet}]}:article)))
 const client=new PublisherClient({baseUrl:'http://127.0.0.1:12345'});await client.registry()
 const candidate=hit()
 if(fault==='unsigned federated') candidate.source={schemaVersion:1,origin:client.origin,sellerKey:keys.publicKey,profileId:'writer',resourceId:'free',version:'v1'}
 const read=client.readFree(candidate,'Writer')
 if(fault==='honest'||fault==='unsigned legacy') expect((await read).body).toBe(body)
 else await expect(read).rejects.toThrow(/proof|signed identity/)
})
