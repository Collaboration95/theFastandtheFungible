export const LINK_KEYS: readonly ['video', 'proof']
export const LINKS_FILE: string
export type HostedLinkFile = { video?: string; proof?: string }
export function validLink(value: unknown): value is string
export function cleanLinks(doc: unknown): HostedLinkFile
