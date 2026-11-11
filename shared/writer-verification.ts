import { z } from 'zod'
const account = z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/)
const hex = z.string().regex(/^(?:[A-Fa-f0-9]{2}){1,64}$/)
export const CredentialIssuerSchema = z.object({ issuer: account, credentialType: hex.transform(s => s.toUpperCase()).optional(), credentialTypeText: z.string().min(1).optional(), label: z.string().min(1).max(80) }).strict().transform((value, ctx) => {
 const derived = value.credentialTypeText === undefined ? undefined : Array.from(new TextEncoder().encode(value.credentialTypeText), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
 const credentialType = value.credentialType ?? derived
 if (!credentialType || !hex.safeParse(credentialType).success || (derived !== undefined && derived !== credentialType)) {
  ctx.addIssue({ code: 'custom', message: 'Provide a valid hex credentialType or UTF-8 credentialTypeText; both must agree' })
  return z.NEVER
 }
 return { issuer: value.issuer, credentialType, label: value.label }
})
export const WriterVerificationSchema = z.union([
  z.literal('unverified writer').transform(() => ({ status: 'unverified' as const })),
  z.discriminatedUnion('status', [
    z.object({ status: z.literal('unverified') }),
    z.object({ status: z.literal('check_failed') }),
    z.object({ status: z.literal('verified'), issuerLabel: z.string().max(80), issuer: account, credentialType: hex,
      domainId: z.string().regex(/^[A-F0-9]{64}$/).optional(), credentialTxHash: z.string().regex(/^[A-F0-9]{64}$/).optional(),
      ledgerIndex: z.number().int().positive(), credentialId: z.string().regex(/^[A-F0-9]{64}$/), expiresAt: z.string().optional(), checkedAt: z.string() }),
  ]),
])
export type WriterVerification = z.infer<typeof WriterVerificationSchema>
export type CredentialIssuer = z.infer<typeof CredentialIssuerSchema>
export const unverified = (): WriterVerification => ({ status: 'unverified' })
export const credentialUrl = (v: WriterVerification) => v.status === 'verified' ? `https://explorer-testnet.xrplf.org/ledger_entry/${v.credentialId}` : undefined

export const credentialDomainUrl = (v: WriterVerification) => v.status === 'verified' && v.domainId ? `https://explorer-testnet.xrplf.org/ledger_entry/${v.domainId}` : undefined
