export const INITIAL_JS_BUDGET: number
export function initialJsGzip(dist?: string): { file: string; gzip: number }[]
export function checkBundleBudget(dist?: string): { bytes: number; budget: number; chunks: { file: string; gzip: number }[] }
