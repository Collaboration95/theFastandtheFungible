// The local first-visit environment note: shown once, inline on an empty Home, until "Got it" or a first question.
const SEEN = 'researchagent.environment-seen'
export const environmentSeen = () => { try { return localStorage.getItem(SEEN) === '1' } catch { return true } }
export const markEnvironmentSeen = () => { try { localStorage.setItem(SEEN, '1') } catch { /* private mode */ } }
