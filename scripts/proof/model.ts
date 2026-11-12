/** Bounded explicit-state abstraction; see PROOF-REPORT.md for the refinement map and limits. */
export const mutations = ['early-body', 'budget-race', 'llm-intent', 'invented-citation', 'missing-label', 'duplicate-charge', 'crash-double-charge'] as const
export type Mutation = typeof mutations[number]
export type Gate = 'G1' | 'G2' | 'G3' | 'G4' | 'G5'
export type Bounds = { intents: number; crashes: number; retries: number; mode: 'key-reveal' | 'conditional'; budget: number }
type State = { p: number[]; granted: boolean[]; readable: boolean[]; cited: boolean[]; lost: boolean[]; charges: number[]; crashes: number; retries: number; down: boolean; expired: boolean; llm: boolean; badCitation: boolean; unlabelled: boolean; early: boolean; freeCited: boolean }
// 0 absent, 1 policy intent, 2 bound quote, 3 reserved, 4 persisted create blob,
// 5 validated create, 6 lock proven, 7 conditional grant OR writer finish,
// 8 finish OR verified grant, 9 proof verified, 10 released body, 11 cited,
// 12 cancelled (budget remains consumed), 13 refused (no principal).
export const defaultBounds: Bounds = { intents: 3, crashes: 2, retries: 2, mode: 'key-reveal', budget: 1 }
const resource = (i: number) => i < 2 ? 0 : i - 1
const occupied = (p: number) => p >= 3 && p <= 12
export function violations(s: State, b: Bounds): Gate[] {
  const gates: Gate[] = []
  if (s.early || s.readable.some((read, i) => read && (!s.granted[i] || s.charges[i] < 1))) gates.push('G1')
  if (s.llm || s.p.filter(occupied).length > b.budget) gates.push('G2')
  if (s.charges.some(n => n > 1)) gates.push('G3')
  if (s.badCitation || s.cited.some((cited,i) => cited && !s.granted[i])) gates.push('G4')
  if (s.unlabelled) gates.push('G5')
  return gates
}
export function checkModel(bounds: Partial<Bounds> = {}, mutation?: Mutation) {
  const b = { ...defaultBounds, ...bounds }
  if (!Number.isInteger(b.intents) || b.intents < 1 || b.intents > 3 || ![b.crashes,b.retries,b.budget].every(n => Number.isInteger(n) && n >= 0 && n <= 3)) throw Error('Bounds out of supported range')
  const started = performance.now()
  const initial: State = { p: Array(b.intents).fill(0), granted: Array(b.intents).fill(false), readable: Array(b.intents).fill(false), cited: Array(b.intents).fill(false), lost: Array(b.intents).fill(false), charges: Array(b.intents).fill(0), crashes: 0, retries: 0, down: false, expired: false, llm: false, badCitation: false, unlabelled: false, early: false, freeCited: false }
  const states = [initial], parents = [-1], actions = ['start'], seen = new Set([JSON.stringify(initial)])
  let transitions = 0
  for (let cursor = 0; cursor < states.length; cursor++) {
    const s = states[cursor], failed = violations(s, b)
    if (failed.length) {
      const trace: string[] = []
      for (let c = cursor; c >= 0; c = parents[c]) trace.push(actions[c])
      return { bounds: b, mutation: mutation ?? null, states: states.length, transitions, durationMs: performance.now()-started, violations: failed, trace: trace.reverse() }
    }
    const edge = (action: string, edit: (n: State) => void) => {
      transitions++
      const n = { ...s, p: [...s.p], granted: [...s.granted], readable: [...s.readable], cited: [...s.cited], lost: [...s.lost], charges: [...s.charges] }; edit(n)
      const key = JSON.stringify(n)
      if (!seen.has(key)) { seen.add(key); states.push(n); parents.push(cursor); actions.push(action) }
    }
    if (s.down) { edge('restart: durable outbox/grants/ledger retained', n => { n.down = false }); continue }
    if (s.crashes < b.crashes) edge(`crash after [${s.p.join(',')}]`, n => { n.down = true; n.crashes++; if (mutation === 'crash-double-charge') n.lost = s.charges.map(c => c > 0) })
    if (!s.expired) edge('quote/escrow deadline expires', n => { n.expired = true })
    if (!s.freeCited) edge('cite existing free passage', n => { n.freeCited = true })
    if (mutation === 'invented-citation') edge('accept nonexistent model citation', n => { n.badCitation = true })
    if (mutation === 'early-body' && s.p.some(p => p >= 2 && p < 8)) edge('preview releases premium bytes', n => { n.early = true })
    for (let i = 0; i < b.intents; i++) {
      const p = s.p[i], set = (name: string, value: number) => edge(`${i}: ${name}`, n => { n.p[i] = value })
      if (p === 0) {
        set('policy creates intent', 1)
        edge(`${i}: LLM requests purchase (refused)`, n => { if (mutation === 'llm-intent') { n.p[i] = 1; n.llm = true } })
      }
      if (p === 1) edge(`${i}: quote binds price/resource/condition; label fixture`, n => { n.p[i] = 2; n.unlabelled = mutation === 'missing-label' })
      if (p === 2) {
        const used = s.p.filter(occupied).length
        const duplicate = s.p.some((v,j) => j !== i && resource(j) === resource(i) && occupied(v))
        set('atomic budget and resource reservation', !s.expired && !duplicate && (used < b.budget || mutation === 'budget-race') ? 3 : 13)
      }
      if (p === 3) set('CAS submit; persist exact create blob with condition', s.expired ? 13 : 4)
      if (p === 4) { set('submit persisted create: validated success', 5); set('create validation failure proves no principal', 13) }
      if (p === 5) set('verify ledger lock proof', 6)
      if (p === 6 && !s.expired) edge(`${i}: ${b.mode === 'key-reveal' ? 'writer EscrowFinish reveals key' : 'store conditional grant (quarantined)'}`, n => { n.p[i] = 7; if (b.mode === 'key-reveal') n.charges[i]++; else n.granted[i] = true })
      if (p === 7 && (b.mode === 'key-reveal' || !s.expired)) edge(`${i}: ${b.mode === 'key-reveal' ? 'validated key; decrypt and store grant' : 'verified delivery; EscrowFinish'}`, n => { n.p[i] = 8; if (b.mode === 'conditional') n.charges[i]++; else n.granted[i] = true })
      if (p === 8) set('proof verified and terminal committed', 9)
      if (p === 9) edge(`${i}: read_paid boundary releases body`, n => { n.p[i] = 10; n.readable[i] = true })
      if (p === 10) edge(`${i}: cite existing granted passage`, n => { n.p[i] = 11; n.cited[i] = true })
      if (s.expired && p >= 5 && (p <= 6 || p === 7 && b.mode === 'conditional')) set('validated EscrowCancel refunds principal', 12)
      if (p >= 4 && p <= 12 && s.retries < b.retries) edge(`${i}: retry/duplicate/reordered delivery uses same object`, n => {
        n.retries++
        if ((mutation === 'duplicate-charge' || mutation === 'crash-double-charge' && s.lost[i]) && s.charges[i] === 1) n.charges[i]++
      })
    }
  }
  return { bounds: b, mutation: mutation ?? null, states: states.length, transitions, durationMs: performance.now()-started, violations: [] as Gate[], trace: [] as string[] }
}
