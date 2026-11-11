export type ControlDocument = { admissionsPaused: boolean; spendingPaused: boolean; reasonCode: string; expiresAt: string }
export type QualifiedMarker = { commit: string; qualifiedAt: string }
export type HealthSample = { at: number; startupz: number | null; readyz: number | null; state: string | null }
export type AutoResumeInput = {
  now: number
  expectedCommit?: string
  runningCommit?: string
  marker?: QualifiedMarker
  before?: ControlDocument
  control?: ControlDocument
  health: HealthSample[] | null
}
export type AutoResumeVerdict = { resume: boolean; code: string; message: string }
export declare const BOOT_REASON: 'deploy'
export declare const AUTO_REASON: 'auto_resume'
export declare const MARKER_FILE: 'qualified.json'
export declare const BOOT_CONTROL_FILE: 'boot-control.json'
export declare const HEALTH_WINDOW: Readonly<{ samples: number; spanMs: number }>
export declare function parseControl(value: unknown): ControlDocument | undefined
export declare function parseMarker(value: unknown): QualifiedMarker | undefined
export declare function healthyRun(samples: HealthSample[]): HealthSample[]
export declare function decideAutoResume(input: AutoResumeInput): AutoResumeVerdict
export declare function probe(options: { port: number; host: string; path: string; timeoutMs?: number }): Promise<{ status: number | null; state: string | null }>
export declare function runAutoResume(options: {
  state?: string; commit?: string; runningCommit?: string; origin?: string; port?: number
  pollMs?: number; maxWaitMs?: number; readyWaitMs?: number; cli?: string
  now?: () => number; sleep?: (ms: number) => Promise<void>
}): Promise<string>
