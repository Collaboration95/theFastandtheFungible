import { ENV, xrpAmount } from '../../shared/presentation'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'

const AgentConnect = lazy(() => import('./AgentConnect'))

type Values = Record<string, string | number>
type WalletRow = {
  name?: string
  role?: string
  address: string
  balanceDrops?: string | null
}
type WriterRow = {
  name: string
  address?: string
  credential?: { status: string }
}
type Agent = { id: string; name: string; paused?: boolean; revoked?: boolean }
type Desktop = {
  agents(): Promise<{ agents: Agent[] }>
  agentCreate(name: string, max: number, daily: number): Promise<unknown>
  agentControl(id: string, op: string): Promise<unknown>
  agentCopy(id: string): Promise<unknown>
  state(): Promise<Record<string, unknown>>
  save(v: unknown): Promise<void>
  presence(a: string): Promise<{ present: boolean | null; available: boolean }>
  secret(a: string, v: string): Promise<{ saved: boolean }>
  test(): Promise<unknown>
  wallets(): Promise<unknown>
  receipts(id: string): Promise<unknown>
  exportData(): Promise<unknown>
  reset(c: string): Promise<void>
  updates(): Promise<void>
}
const native = (window as unknown as { desktop?: Desktop }).desktop
const sections = [
  'Models',
  'Network',
  'Budget and limits',
  'Payments',
  'Wallets',
  'Writers',
  'Connect an agent',
  'Data',
  'About'
]
const keys = {
  LLM_API_KEY: 'compatible',
  DEEPSEEK_API_KEY: 'deepseek',
  OPENAI_API_KEY: 'openai',
  CLOUDFLARE_API_TOKEN: 'cloudflare',
  CLOUDFLARE_ACCOUNT_ID: 'cloudflare-account'
}
const repo = 'https://github.com/Collaboration95/theFastandtheFungible'
/** Display names only: saved values stay the stored identifiers. */
const OPTION_LABEL: Record<string, string> = {
  simulated: ENV.simulatedShort,
  'xrpl-testnet': ENV.testnet,
  'key-reveal': 'Key-reveal escrow',
  payment: 'Direct payment',
  'TEST-SGD': 'TEST-SGD · test issued asset',
  off: 'Off'
}
const KEY_LABEL: Record<string, string> = {
  LLM_API_KEY: 'OpenAI-compatible API key',
  DEEPSEEK_API_KEY: 'DeepSeek API key',
  OPENAI_API_KEY: 'OpenAI API key',
  CLOUDFLARE_API_TOKEN: 'Cloudflare API token',
  CLOUDFLARE_ACCOUNT_ID: 'Cloudflare account ID'
}
export default function OwnerSettings({
  children,
  notifications,
  realCorpus = false
}: {
  realCorpus?: boolean
  children?: ReactNode
  notifications?: ReactNode
}) {
  const [agents, setAgents] = useState<Agent[]>([]),
    [section, setSection] = useState('Models'),
    [values, setValues] = useState<Values>({}),
    [state, setState] = useState<Record<string, unknown>>({}),
    [csrf, setCsrf] = useState(''),
    [status, setStatus] = useState('Loading settings…'),
    [presence, setPresence] = useState<Record<string, string>>({}),
    [account, setAccount] = useState('DEEPSEEK_API_KEY'),
    [secret, setSecret] = useState(''),
    [confirm, setConfirm] = useState(''),
    [receiptRun, setReceiptRun] = useState(''),
    [ledger, setLedger] = useState<string | WalletRow[]>('Loading…'),
    [writers, setWriters] = useState<string | WriterRow[]>('Loading…')
  const onboarding = new URLSearchParams(location.search).has('onboarding')
  const call = async (path = '', body?: unknown) => {
    const response = await fetch('/api/settings' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Settings-CSRF': csrf,
        'X-Settings-UI': location.origin
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })
    if (!response.ok)
      throw new Error(
        response.status === 403
          ? 'Settings requires the local owner UI.'
          : 'Action unavailable. Check configuration and retry.'
      )
    return response.json()
  }
  useEffect(() => {
    let alive = true
    void (async () => {
      if (native) {
        const s = await native.state()
        const registry = await native.agents()
        if (!alive) return
        setAgents(registry.agents)
        setState(s)
        setValues({
          MCP_MAX_BUDGET_MINOR: Number(s.maxMinor),
          MCP_DAILY_CAP_MINOR: Number(s.dailyMinor),
          WALLET_DAILY_CAP_MINOR: Number(s.walletDailyMinor),
          SETTLEMENT_RAIL: s.live ? 'xrpl-testnet' : 'simulated',
          ESCROW_MODE: String(s.ESCROW_MODE || 'key-reveal'),
          ESCROW_ASSET: String(s.ESCROW_ASSET || 'XRP'),
          ANCHOR_RAIL: String(s.ANCHOR_RAIL || 'xrpl-testnet')
        })
        for (const [key, a] of Object.entries(keys)) {
          const p = await native.presence(a)
          if (alive)
            setPresence((old) => ({
              ...old,
              [key]: !p.available
                ? 'Keychain unavailable — unlock and retry'
                : p.present
                  ? '••••••••'
                  : 'Not configured'
            }))
        }
      } else {
        const s = await call()
        if (!alive) return
        setState(s)
        setValues(s.values)
        setCsrf(s.csrf)
        setPresence(s.keys)
      }
      if (alive)
        setStatus(
          'Only you can change these settings. Policy code remains the spending authority.'
        )
    })().catch(() => {
      if (alive)
        setStatus(
          native
            ? 'Unlock Keychain or restart the desktop app, then retry.'
            : 'Check the server connection, then reopen Settings.'
        )
    })
    void fetch('/api/ledger')
      .then((r) => r.json())
      .then((v) => {
        if (alive)
          setLedger(
            v.rail === 'simulated'
              ? 'Simulated wallets have no ledger balance'
              : v.wallets
          )
      })
      .catch(() => setLedger('Balances unavailable while the engine recovers.'))
    void fetch('/api/writers/status')
      .then((r) => {
        if (!r.ok) throw Error()
        return r.json()
      })
      .then((v) => {
        if (alive) setWriters(v.publishers)
      })
      .catch(() =>
        setWriters(
          'Writer credential status unavailable. Open Writers after the engine reconnects.'
        )
      )
    return () => {
      alive = false
    }
    // The owner surface loads once; secrets never enter persistent React state after save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const action = (fn: () => Promise<unknown>, message: string) => {
    setStatus('Working…')
    void Promise.resolve().then(fn)
      .then(() => setStatus(message))
      .catch((e) =>
        setStatus(e instanceof Error ? e.message : 'Action failed.')
      )
  }
  const save = () =>
    action(
      async () => {
        if (native)
          await native.save({
            provider: state.provider,
            baseUrl: state.baseUrl,
            model: state.model,
            sameKeyDecisions: state.sameKeyDecisions,
            live: values.SETTLEMENT_RAIL === 'xrpl-testnet',
            maxMinor: values.MCP_MAX_BUDGET_MINOR,
            dailyMinor: values.MCP_DAILY_CAP_MINOR,
            walletDailyMinor: values.WALLET_DAILY_CAP_MINOR,
            ESCROW_MODE: values.ESCROW_MODE,
            ESCROW_ASSET: values.ESCROW_ASSET,
            ANCHOR_RAIL: values.ANCHOR_RAIL,
            onboarded: true
          })
        else await call('', values)
      },
      native
        ? 'Saved. Engine restarting; active work stops.'
        : 'Saved and audited. Restart the app to apply configuration changes.'
    )
  const field = (name: string, label: string, options?: string[]) => (
    <label className="owner-field" key={name}>
      {label}
      {options ? (
        <select
          value={values[name] ?? ''}
          onChange={(e) => setValues({ ...values, [name]: e.target.value })}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {OPTION_LABEL[o] ?? o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="number"
          min="0"
          step={0.05}
          max={name === 'MCP_MAX_BUDGET_MINOR' ? 5 : 1000}
          value={Number(values[name] ?? 0) / 100}
          onChange={(e) =>
            setValues({
              ...values,
              [name]: Math.round(Number(e.target.value) * 100)
            })
          }
        />
      )}
    </label>
  )
  const version = typeof state.version === 'string' ? state.version : undefined,
    command = version
      ? `claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=${values.MCP_MAX_BUDGET_MINOR ?? 0} -e MCP_DAILY_CAP_MINOR=${values.MCP_DAILY_CAP_MINOR ?? 0} -- npx -y ${repo}/releases/download/v${version}/researchagent-mcp-${version}.tgz --testnet`
      : 'Version unavailable. Reopen Settings after reconnecting.'
  const download = (value: unknown, name: string) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
    )
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="owner-settings">
      {onboarding && (
        <section className="owner-welcome">
          <p className="ra-caption">First run</p>
          <h2>Make this workspace yours</h2>
          <p>
            Start with the offline demo (simulated payments) or XRPL Testnet
            (test funds). The offline demo needs no keys. Confirm your limits
            before continuing.
          </p>
          {field('SETTLEMENT_RAIL', 'Network', ['simulated', 'xrpl-testnet'])}
          {field('MCP_MAX_BUDGET_MINOR', 'Budget limit (S$)')}
          {field('MCP_DAILY_CAP_MINOR', 'Daily agent limit (S$)')}
          <button className="owner-primary" onClick={save}>
            Confirm limits and start
          </button>
        </section>
      )}
      <nav aria-label="Settings sections">
        {sections.map((s) => (
          <button
            key={s}
            aria-current={s === section ? 'page' : undefined}
            onClick={() => setSection(s)}
          >
            {s}
          </button>
        ))}
      </nav>
      <section className="owner-panel" aria-labelledby="owner-heading">
        <p className="ra-caption">
          Your workspace · {native ? 'macOS Keychain' : 'Browser settings'}
        </p>
        <h2 id="owner-heading">{section}</h2>
        {section === 'Models' && (
          <>
            {native && (
              <>
                <label className="owner-field">
                  Research provider
                  <select
                    value={String(state.provider || 'deepseek')}
                    onChange={(e) =>
                      setState({ ...state, provider: e.target.value })
                    }
                  >
                    {['deepseek', 'openai', 'openai-compatible'].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                {state.provider === 'openai-compatible' && (
                  <>
                    <label className="owner-field">
                      API base URL
                      <input
                        value={String(state.baseUrl || '')}
                        onChange={(e) =>
                          setState({ ...state, baseUrl: e.target.value })
                        }
                      />
                    </label>
                    <label className="owner-field">
                      Model
                      <input
                        value={String(state.model || '')}
                        onChange={(e) =>
                          setState({ ...state, model: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={state.sameKeyDecisions === true}
                        onChange={(e) =>
                          setState({
                            ...state,
                            sameKeyDecisions: e.target.checked
                          })
                        }
                      />{' '}
                      Use compatible advisory decisions (UNCALIBRATED)
                    </label>
                  </>
                )}
                <button onClick={save}>Apply provider profile</button>
              </>
            )}
            <p>
              Saved credentials are masked. Keys and seeds never appear in
              exports or logs.
            </p>
            <div className="owner-keys">
              {Object.entries(presence).map(([k, v]) => (
                <p key={k}>
                  <b>{KEY_LABEL[k] ?? k.replaceAll('_', ' ')}</b>
                  <br />
                  {v}
                </p>
              ))}
            </div>
            <label className="owner-field">
              Provider
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                {Object.keys(keys).map((k) => (
                  <option key={k} value={k}>
                    {KEY_LABEL[k] ?? k}
                  </option>
                ))}
              </select>
            </label>
            <label className="owner-field">
              Replace key
              <input
                type="password"
                autoComplete="new-password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </label>
            <button
              disabled={!secret}
              onClick={() => {
                const value = secret
                setSecret('')
                action(
                  async () => {
                    if (native) {
                      const r = await native.secret(
                        keys[account as keyof typeof keys],
                        value
                      )
                      if (!r.saved)
                        throw Error('Keychain unavailable. Unlock and retry.')
                      setPresence({ ...presence, [account]: '••••••••' })
                    } else {
                      await call('/key', { account, value })
                      setPresence({ ...presence, [account]: '••••••••' })
                    }
                  },
                  native
                    ? 'Key saved in Keychain.'
                    : 'Key saved in the local environment file. Restart to apply.'
                )
              }}
            >
              Save key
            </button>
            <button
              onClick={() =>
                action(async () => {
                  if (native) {
                    const r = (await native.test()) as {
                      ok?: boolean
                      error?: { code?: string }
                    }
                    if (r.error?.code === 'engine_unavailable')
                      throw Error(
                        'Engine unavailable. Unlock Keychain, check configuration or retry from Recovery.'
                      )
                    if (!r.ok)
                      throw Error(
                        'Provider test failed. Check Keychain and provider configuration.'
                      )
                    return
                  }
                  const response = await fetch('/api/providers/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{}'
                  })
                  const result = await response.json()
                  if (!result.ok)
                    throw Error(
                      'Connection failed. Save credentials and restart the app, then retry.'
                    )
                }, 'Connection test finished. See the provider status for details.')
              }
            >
              Test connection
            </button>
          </>
        )}
        {section === 'Network' && (
          <>
            <p>
              {realCorpus ? 'A network change restarts the engine.' : 'Offline demo: fictional writers, simulated payments, no real money. XRPL Testnet tokens have no real value. A network change restarts the engine.'}
            </p>
            {field('SETTLEMENT_RAIL', 'Network', ['simulated', 'xrpl-testnet'])}
          </>
        )}
        {section === 'Budget and limits' && (
          <>
            <p>
              Owner limits, in S$. Changes are audited. A budget authorizes
              policy code to buy within these caps.
            </p>
            <div className="owner-caps">
              {field('MCP_MAX_BUDGET_MINOR', 'Budget limit (S$)')}
              {field('MCP_DAILY_CAP_MINOR', 'Daily agent limit (S$)')}
              {field('WALLET_DAILY_CAP_MINOR', 'Daily wallet limit (S$)')}
            </div>
            {children}
            <p>
              The budget remains the spending authorization for each question.
            </p>
          </>
        )}
        {section === 'Payments' && (
          <>
            <p>
              Testnet only · no real money. TEST-SGD is a test issued asset and
              needs a configured issuer and trustlines.
            </p>
            {field('ESCROW_MODE', 'Escrow mode', ['key-reveal', 'payment'])}
            {field('ESCROW_ASSET', 'Escrow asset', ['XRP', 'TEST-SGD'])}
            {field('ANCHOR_RAIL', 'Answer anchoring', ['xrpl-testnet', 'off'])}
          </>
        )}
        {section === 'Wallets' && (
          <>
            <p>Public addresses and balances only. Seeds stay private.</p>
            {typeof ledger === 'string' ? (
              <p>{ledger}</p>
            ) : (
              <table className="owner-table">
                <thead>
                  <tr>
                    <th>Wallet</th>
                    <th>Address</th>
                    <th>XRP balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((w) => (
                    <tr key={w.address}>
                      <td>{w.name || w.role || 'Wallet'}</td>
                      <td className="owner-address">{w.address}</td>
                      <td>
                        {w.balanceDrops == null
                          ? 'Unavailable'
                          : xrpAmount(w.balanceDrops)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button
              onClick={() =>
                action(async () => {
                  if (native) setLedger((await native.wallets()) as WalletRow[])
                  else {
                    await call('/faucet', {})
                    setLedger(
                      'Faucet accepted the request. Reopen Settings to refresh validated balances.'
                    )
                  }
                }, 'Testnet faucet request finished.')
              }
            >
              Testnet faucet top-up
            </button>
            <label className="owner-field">
              Run to verify
              <select
                value={receiptRun}
                onChange={(e) => setReceiptRun(e.target.value)}
              >
                <option value="">Choose a completed run</option>
                {(
                  (state.runs || []) as { runId: string; question: string }[]
                ).map((r) => (
                  <option key={r.runId} value={r.runId}>
                    {r.question}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={!receiptRun}
              onClick={() =>
                action(
                  async () =>
                    download(
                      native
                        ? await native.receipts(receiptRun)
                        : await call(
                            '/receipts/' + encodeURIComponent(receiptRun)
                          ),
                      'receipts.json'
                    ),
                  'Receipts downloaded.'
                )
              }
            >
              Export receipts
            </button>
            <p>
              Export a run’s receipts.json from its receipt panel for
              researchagent verify. Export everything in Data includes a bundle
              per run.
            </p>
          </>
        )}
        {section === 'Writers' && (
          <>
            <p>
              No followed-writer list is configured. Available writers and XRPL
              Credential status are read-only here. Unavailable or unverified
              status never implies verification.
            </p>
            {typeof writers === 'string' ? (
              <p>{writers}</p>
            ) : (
              <table className="owner-table">
                <thead>
                  <tr>
                    <th>Writer</th>
                    <th>XRPL Credential</th>
                  </tr>
                </thead>
                <tbody>
                  {writers.map((w) => (
                    <tr key={w.name}>
                      <td>{w.name}</td>
                      <td>{w.credential?.status || 'unverified'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
        {section === 'Connect an agent' && (
          <>
            <Suspense fallback={<p role="status">Loading connection details…</p>}><AgentConnect /></Suspense>
            <p>
              Uses this version and your selected caps. The agent cannot edit
              Settings. This creates a separate local Testnet agent process.
            </p>
            <pre tabIndex={0} aria-label="Claude installation command">
              {command}
            </pre>
            <button
              disabled={!version}
              onClick={() =>
                action(
                  () => navigator.clipboard.writeText(command),
                  'Command copied.'
                )
              }
            >
              Copy Claude command
            </button>
            {native && (
              <>
                <h3>Connections to this desktop</h3>
                <p>
                  Independent agent allowances share the wallet cap. Secret
                  configs copy directly from Keychain.
                </p>
                {['Claude Desktop', 'Claude Code', 'Cursor', 'Codex'].map(
                  (name) => (
                    <button
                      key={name}
                      onClick={() =>
                        action(async () => {
                          await native.agentCreate(
                            name,
                            Number(values.MCP_MAX_BUDGET_MINOR),
                            Number(values.MCP_DAILY_CAP_MINOR)
                          )
                          setAgents((await native.agents()).agents)
                        }, 'Connection created.')
                      }
                    >
                      Add {name}
                    </button>
                  )
                )}
                {agents.map((agent) => (
                  <div key={agent.id}>
                    <b>{agent.name}</b>
                    <p>
                      {agent.revoked
                        ? 'Revoked'
                        : agent.paused
                          ? 'Paused'
                          : 'Active'}
                    </p>
                    <button
                      disabled={agent.revoked}
                      onClick={() =>
                        action(
                          () => native.agentCopy(agent.id),
                          'Private config copied. Protect your clipboard.'
                        )
                      }
                    >
                      Copy config
                    </button>
                    {['pause', 'resume', 'revoke'].map((op) => (
                      <button
                        key={op}
                        className={op === 'revoke' ? 'owner-danger' : undefined}
                        disabled={agent.revoked}
                        onClick={() => {
                          if (
                            op === 'revoke' &&
                            !window.confirm(
                              'Revoke this agent’s access? Its payment records will be kept.'
                            )
                          )
                            return
                          action(async () => {
                            await native.agentControl(agent.id, op)
                            setAgents((await native.agents()).agents)
                          }, 'Connection updated.')
                        }}
                      >
                        {op.charAt(0).toUpperCase() + op.slice(1)}
                      </button>
                    ))}
                  </div>
                ))}
              </>
            )}
          </>
        )}
        {section === 'Data' && (
          <>
            <p>
              Storage:{' '}
              {String(state.storage || 'Application Support/ResearchAgent')}
            </p>
            <button
              onClick={() =>
                action(
                  async () =>
                    download(
                      native
                        ? await native.exportData()
                        : await call('/export'),
                      'researchagent-export.json'
                    ),
                  'Export downloaded.'
                )
              }
            >
              Export everything
            </button>
            <p>
              Reset preferences preserves payment journals, receipts and wallet
              seeds for recovery.
            </p>
            <label className="owner-field">
              Type RESET SETTINGS
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            <button
              className="owner-danger"
              disabled={confirm !== 'RESET SETTINGS'}
              onClick={() =>
                action(
                  () =>
                    native
                      ? native.reset(confirm)
                      : call('/reset', { confirmation: confirm }),
                  'Settings reset. Restart to apply.'
                )
              }
            >
              Reset settings
            </button>
          </>
        )}
        {section === 'About' && (
          <>
            <p>ResearchAgent {version || '(version unavailable)'}</p>
            <p>Research with a wallet.</p>
            <a
              href={version ? `${repo}/releases/tag/v${version}` : `${repo}/releases`}
              target="_blank"
              rel="noreferrer"
            >
              Release notes
            </a>
            <p>
              MIT licence · Electron, React and XRPL dependencies retain their
              own licences.
            </p>
            <button
              onClick={() =>
                action(async () => {
                  if (native) await native.updates()
                  else window.open(`${repo}/releases`, '_blank', 'noopener')
                }, 'Update check opened.')
              }
            >
              Check for updates
            </button>
            {notifications}
          </>
        )}
        {['Network', 'Budget and limits', 'Payments'].includes(section) && (
          <button className="owner-save owner-primary" onClick={save}>
            Save settings
          </button>
        )}
        <p role="status" className="owner-status">
          {status}
        </p>
      </section>
    </div>
  )
}
