import type { Manifest } from '../../shared/contracts/manifest.js'
import { verifyManifestSignature } from '../../shared/manifest.js'
import { acceptedCredential } from '../../server/writer-credentials.js'
import { screenSanctions } from '../../server/payee-screening.js'
import type { WriterVerification } from '../../shared/writer-verification.js'
export const WRITER_CREDENTIAL_REFUSAL = 'Writer needs an accepted credential for this operator; nothing was charged'
export const BUYER_CREDENTIAL_REFUSAL = 'Buyer needs an accepted credential for this publisher; nothing was charged'
export async function regulatedWriterRefusal(manifest: Manifest | undefined, env: NodeJS.ProcessEnv = process.env, verify: (subject:string,env:NodeJS.ProcessEnv)=>Promise<WriterVerification> = acceptedCredential): Promise<string | undefined> {
  if (env.REGULATED_MODE !== 'on') return
  if (!/^[a-f0-9]{64}$/i.test(env.WRITER_CREDENTIAL_DOMAIN ?? '') || !manifest || !verifyManifestSignature(manifest)) return WRITER_CREDENTIAL_REFUSAL
  return credentialPayeeRefusal(manifest.wallet,env,verify)
}
export async function credentialPayeeRefusal(subject:string,env:NodeJS.ProcessEnv=process.env,verify:(subject:string,env:NodeJS.ProcessEnv)=>Promise<WriterVerification>=acceptedCredential) {
  if(env.REGULATED_MODE!=='on')return
  if(!/^[a-f0-9]{64}$/i.test(env.WRITER_CREDENTIAL_DOMAIN ?? ''))return WRITER_CREDENTIAL_REFUSAL
  const screened=screenSanctions(subject);if(screened)return screened.refusal
  const value=await verify(subject,env).catch(()=>({status:'check_failed'} as const))
  if(value.status!=='verified'||value.domainId!==env.WRITER_CREDENTIAL_DOMAIN?.toUpperCase())return WRITER_CREDENTIAL_REFUSAL
}

export async function regulatedBuyerRefusal(subject: string, env:NodeJS.ProcessEnv, verify: (subject:string,env:NodeJS.ProcessEnv)=>Promise<WriterVerification> = acceptedCredential) {
  if(env.PUBLISHER_REGULATED_MODE!=='on')return
  if(!/^[a-f0-9]{64}$/i.test(env.WRITER_CREDENTIAL_DOMAIN ?? ''))return BUYER_CREDENTIAL_REFUSAL
  const value=await verify(subject,env).catch(()=>({status:'check_failed'} as const))
  if(value.status!=='verified'||value.domainId!==env.WRITER_CREDENTIAL_DOMAIN?.toUpperCase())return BUYER_CREDENTIAL_REFUSAL
}
