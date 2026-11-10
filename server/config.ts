import { z } from 'zod'

// Keep names and empty-string/nullish precedence intact for existing launchers. Defaults
// stay at their consumers; validation happens here, before listeners or providers start.
const text = z.string().optional()
const numeric = (check: (n: number) => boolean) => z.string().refine(value =>
  value === '' || (Number.isFinite(Number(value)) && check(Number(value)))).optional()
const positive = numeric(n => n > 0)
const port = numeric(n => Number.isInteger(n) && n >= 0 && n <= 65535)
const url = z.string().refine(value => {
  if (value === '') return true
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}).optional()
const cap = z.string().regex(/^\d+$/).refine(value => Number.isSafeInteger(Number(value))).optional()
const mode = (values: [string, ...string[]]) => z.preprocess(v => typeof v === 'string' ? v.trim().toLowerCase() : v, z.enum(['', ...values]).optional())
const assetMode = z.preprocess(v => typeof v === 'string' ? ({'xrp':'XRP','test-sgd':'test-iou','test-iou':'test-iou'}[v.trim().toLowerCase()] ?? v) : v,z.enum(['','XRP','test-iou']).optional())
const ConfigSchema = z.object({
  RA_API_TOKEN: text, RA_ALLOWED_HOSTS: text, RA_WEB_ORIGIN: url, WALLET_DAILY_CAP_MINOR: cap, SPENDING_PAUSED: z.enum(['0', '1']).optional(), LEGACY_GAP: z.enum(['0', '1']).optional(),
  ACTIVE_WORK_LIMIT: numeric(n => Number.isInteger(n) && n > 0), RECONCILE_INTERVAL_MS: positive, LOG_FORMAT: z.enum(['json', 'human']).optional(), MODEL_INPUT_USD_PER_MILLION: numeric(n => n >= 0), MODEL_OUTPUT_USD_PER_MILLION: numeric(n => n >= 0),
  PORT: port, HOST: text, APP_DB: text, REPORT_DIR: text,
  PUBLISHER_URLS: text, PUBLISHER_URL: url, PUBLISHER_SECRET: text, PUBLISHER_FAULTS: text,
  WRITER_CREDENTIAL_ISSUERS: text, ANCHOR_RAIL: mode(['off','xrpl-testnet']), SETTLEMENT_RAIL: mode(['simulated','xrpl-testnet']), XRPL_PAYER_SEED: text, XRPL_PAYER_ADDRESS: text, XRPL_RPC_URL: text,
  LLM_PROVIDER: mode(['fixture','deepseek','groq','openai-compatible']), LLM_BASE_URL: url, LLM_MODEL: text, LLM_API_KEY: text,
  DEEPSEEK_API_KEY: text, GROQ_API_KEY: text,
  LLM_TIMEOUT_MS: positive, LLM_SYNTHESIS_TIMEOUT_MS: positive,
  DECISION_BASE_URL: url, DECISION_API_KEY: text, DECISION_PROVIDER: mode(['fixture','openai','cloudflare','compatible']), DECISION_MODEL: text, CLEF_TIMEOUT_MS: positive, DECISION_TIMEOUT_MS: positive,
  DECISIONS_MAX_QUESTIONS: numeric(n => Number.isInteger(n) && n >= 4),
  DECISIONS_WORDING: text, DECISIONS_GAP_WORDING: text,
  BUY_THRESHOLD: numeric(n => n >= 0 && n <= 1), DECISION_CALIBRATION: text, DECISION_CALIBRATION_DIR: text,
  CLOUDFLARE_API_TOKEN: text, CLOUDFLARE_ACCOUNT_ID: text,
  CLOUDFLARE_API_TOKEN_2: text, CLOUDFLARE_ACCOUNT_ID_2: text, CF_BACKUP: text, SEARCH_EMBEDDINGS: mode(['off','live']), ESCROW_MODE: mode(['key-reveal','payment']), ESCROW_ASSET: assetMode,
  LANGFUSE_ENABLED: text, LANGFUSE_PUBLIC_KEY: text, LANGFUSE_SECRET_KEY: text,
  LANGFUSE_BASE_URL: url, LANGFUSE_TRACING_ENVIRONMENT: text, LANGFUSE_PUBLIC_TRACES: text,
  OPENAI_API_KEY: text, MCP_MAX_BUDGET_MINOR: cap, MCP_DAILY_CAP_MINOR: cap,
  RA_BACKEND_URL: url, RA_DATA_DIR: text, RA_LIVE: text,
  DEMO_PORT_OFFSET: numeric(n => Number.isInteger(n)),
}).catchall(text)
export type Config = z.infer<typeof ConfigSchema>

/** Never expose Zod's input or error details: configuration can contain credentials. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env)
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map(issue => String(issue.path[0])))].sort()
    throw new Error(`Invalid configuration: ${names.join(', ')}`)
  }
  return parsed.data
}

/** Only the isolated worker receives overrides; the parent's environment is never mutated. */
export function engineEnvironment(overrides: NodeJS.ProcessEnv): Config {
  return loadConfig({ ...process.env, ...overrides })
}
