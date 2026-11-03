import { z } from 'zod'
/** Routing context v1 is not part of the publisher's signed protocol. */
export const SourceIdentitySchema = z.object({ schemaVersion: z.literal(1), origin: z.string().url(), sellerKey: z.string().min(1), profileId: z.string().min(1), resourceId: z.string().min(1), version: z.string().min(1) }).strict()
export type SourceIdentity = z.infer<typeof SourceIdentitySchema>
export type SourceRef = { source?: SourceIdentity; resourceId: string; version: string }
export const sourceKey = (s: SourceRef): string => s.source ? JSON.stringify([s.source.origin, s.source.sellerKey, s.source.profileId, s.source.resourceId, s.source.version]) : `${s.resourceId}@${s.version}`
export const sameSource = (a: SourceRef, b: SourceRef) => sourceKey(a) === sourceKey(b)
export const citationIdentity = (s: SourceRef & { spanId: string }) => JSON.stringify([sourceKey(s), s.spanId])
export const sourceBinding = (s: SourceRef & { profileId?: string }) => !s.source || s.source.resourceId === s.resourceId && s.source.version === s.version && (!s.profileId || s.source.profileId === s.profileId)

/** A writer moving hosts retains one royalty share; distinct signing keys do not collide. */
export const sourceWriterKey = (s: SourceRef & { profileId: string }): string => s.source ? JSON.stringify([s.source.profileId, s.source.sellerKey]) : s.profileId
