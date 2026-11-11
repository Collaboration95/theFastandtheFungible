export type CheckStatus = 'GO' | 'NO-GO' | 'NOT CHECKED'
export interface CheckResult { id: string; name: string; status: CheckStatus; detail: string; advisory?: boolean; data?: { state?: string; questions?: number; minor?: number; ahead?: number } }
export interface Fallback { tier: number; ready: boolean; missing: string[] }
export interface Decision { tier: 1 | 2 | 3 | 4; name: string; say: string; show: string; fallbacks: Fallback[]; notes: string[] }
export interface Deps {
  fetch: (url: string, init?: Record<string, unknown>) => Promise<unknown>
  WebSocket: unknown
  exists: (file: string) => boolean
  readFile: (file: string) => Uint8Array
  run: (file: string, signal?: AbortSignal) => Promise<{ code: number; output: string }>
}
export interface Options { hosted?: string; deck?: string; video?: string; ms?: number; jarFile?: string }
export const ROOT: string
export const CHECK_MS: number
export const KEY_TX: string
export const RECEIPTS_SHA256: string
export const NODES: string[]
export const PAGES: string
export const EXPLORER: string
export const FORBIDDEN_PORTS: number[]
export const REPLAY_BASE: string
export const REPLAY_CSP: string
export const TIERS: Record<number, { name: string; say: string; show: string }>
export const DEFAULTS: { hosted: string; deck: string; receipts: string; evidence: string }
export function timed<T>(ms: number, work: (signal: AbortSignal) => Promise<T> | T): Promise<T>
export function cookieJar(file?: string): { header(): string; absorb(response: unknown): void; save(): void; readonly size: number }
export function defaultDeps(): Deps
export function runChecks(options?: Options, deps?: Deps): Promise<CheckResult[]>
export function decideTier(results: CheckResult[]): Decision
export function renderReport(results: CheckResult[], decision: Decision, options?: { hosted?: string; when?: Date }): string
export function serveReplay(options: { dir: string; base?: string }): Promise<{ port: number; url: string; close(): Promise<void> }>
export function buildReplay(outDir: string): Promise<void>
export function parseArgs(argv: string[]): { json: boolean; serveReplay: boolean; rebuild: boolean; help?: boolean; video?: string; deck?: string; replayDir?: string; jarFile?: string; hosted?: string; ms?: number }
export function main(argv?: string[], deps?: Deps, io?: { out(text: string): void; err(text: string): void }): Promise<number>
