const byId = id => document.getElementById(id)
const status = text => { byId('status').textContent = text }
const action = async work => {
  try { await work() } catch { status('Action failed. Check Keychain access, provider setup, or Testnet connectivity. No credentials are logged.') }
}
void action(async () => {
  const state = await window.desktop.state()
  for (const key of ['live', 'sameKeyDecisions']) byId(key).checked = state[key]
  for (const key of ['maxMinor', 'dailyMinor', 'walletDailyMinor']) byId(key).value = state[key]
  byId('resume').disabled = state.emergencyPaused
  for (const key of ['provider', 'baseUrl', 'model']) byId(key).value = state[key]
  byId('backend').value = state.backend
  byId('remoteUrl').value = state.remoteUrl
  byId('walletDailyMinor').disabled = state.backend === 'remote'
  byId('walletStatus').textContent = state.wallet?.wallet ? `Wallet cap S$${(state.wallet.wallet.dailyMinor / 100).toFixed(2)} · gross spent S$${(state.wallet.wallet.spentMinor / 100).toFixed(2)} · ${state.wallet.wallet.paused ? 'paused' : 'active'}` : 'Backend unavailable; choose Local engine to recover.'
  status(`Ready · ${state.wallet?.labels.settlement ?? 'backend unavailable'} · cold start ${state.coldStartMs} ms`)
})
byId('credentials').onsubmit = event => {
  event.preventDefault()
  const value = byId('value').value; byId('value').value = ''
  void action(async () => { const result = await window.desktop.secret(byId('account').value, value); showPresence(result); status(result.saved ? 'Saved in macOS Keychain. Engine restarting.' : 'Keychain write failed. Presence refreshed.') })
}
byId('wallets').onclick = () => void action(async () => {
  byId('wallets').disabled = true; status('Funding Testnet wallets. This can take a minute…')
  try { const wallets = await window.desktop.wallets(); status(`Testnet wallets saved in Keychain. Buyer: ${wallets[0].address}`) }
  finally { byId('wallets').disabled = false }
})
byId('mcp').onclick = () => void action(async () => { byId('command').textContent = await window.desktop.mcp(); status('MCP setup copied.') })
byId('apply').onclick = () => void action(() => window.desktop.save({ backend: byId('backend').value, remoteUrl: byId('remoteUrl').value, walletDailyMinor: Number(byId('walletDailyMinor').value), live: byId('live').checked, provider: byId('provider').value, baseUrl: byId('baseUrl').value, model: byId('model').value, sameKeyDecisions: byId('sameKeyDecisions').checked, maxMinor: Number(byId('maxMinor').value), dailyMinor: Number(byId('dailyMinor').value) }))

async function renderAgents() {
  const state = await window.desktop.agents()
  byId('endpoint').textContent = state.url || 'Select Local engine to connect agents.'
  byId('agents').replaceChildren()
  for (const name of ['Claude Desktop', 'Claude Code', 'Cursor', 'Codex']) {
    const panel = document.createElement('section')
    const title = document.createElement('h3'); title.textContent = name; panel.append(title)
    const max = document.createElement('input'); max.type = 'number'; max.min = '0'; max.max = '500'; max.value = '100'; max.setAttribute('aria-label', `${name} per-call allowance in SGD cents`)
    const daily = document.createElement('input'); daily.type = 'number'; daily.min = '0'; daily.value = '200'; daily.setAttribute('aria-label', `${name} daily allowance in SGD cents`)
    const label = document.createElement('p'); label.textContent = 'New connection · per call / daily (SGD cents)'; panel.append(label, max, daily)
    const button = (text, work) => { const b = document.createElement('button'); b.textContent = text; b.onclick = () => void action(async () => { b.disabled = true; try { await work(); await renderAgents() } finally { b.disabled = false } }); panel.append(b) }
    if (state.url) button('Create connection', () => window.desktop.agentCreate(name, Number(max.value), Number(daily.value)))
    for (const agent of state.agents.filter(a => a.name === name)) {
      const row = document.createElement('p')
      row.textContent = `${agent.id.slice(0, 8)} · ${agent.revoked ? 'Revoked' : agent.paused ? 'Paused' : 'Active'} · S$${(agent.maxMinor / 100).toFixed(2)}/call · S$${(agent.dailyMinor / 100).toFixed(2)}/day · Spent S$${(agent.spentMinor / 100).toFixed(2)} · Reserved S$${(agent.reservedMinor / 100).toFixed(2)} · Last call ${agent.lastCall || 'Never'}`
      panel.append(row)
      if (!agent.revoked) {
        button('Copy config', async () => { await window.desktop.agentCopy(agent.id); status('Private config copied to clipboard.') })
        button(agent.paused ? 'Resume' : 'Pause', () => window.desktop.agentControl(agent.id, agent.paused ? 'resume' : 'pause'))
        button('Revoke', () => window.desktop.agentControl(agent.id, 'revoke'))
      }
    }
    byId('agents').append(panel)
  }
}
void action(renderAgents)
setInterval(() => { if (!document.hidden && !byId('agents').contains(document.activeElement)) void action(renderAgents) }, 10000)

const showPresence = result => { byId('keyPresence').textContent = !result.available ? 'Keychain unavailable; presence unknown' : result.present ? 'Key present' : 'Key absent' }
byId('presence').onclick = () => void action(async () => showPresence(await window.desktop.presence(byId('account').value)))
byId('delete').onclick = () => void action(async () => { const result = await window.desktop.deleteSecret(byId('account').value); showPresence(result); status(result.deleted ? 'Selected credential deleted. Wallet seeds are preserved.' : 'Keychain delete failed. Presence refreshed.') })
byId('test').onclick = () => void action(async () => {
  byId('testResult').textContent = 'Testing…'
  const result = await window.desktop.test()
  byId('testResult').textContent = result.ok ? `Connected · ${result.latencyMs ?? 'unavailable'} ms · input tokens ${result.inputTokens ?? 'unavailable'} · output tokens ${result.outputTokens ?? 'unavailable'} · cost ${typeof result.costUsd === 'number' ? '$' + result.costUsd : 'unavailable'}` : result.error?.message || 'Connection test failed'
})
for (const operation of ['pause', 'resume']) byId(operation).onclick = () => void action(async () => { await window.desktop.pause(operation === 'pause'); status(operation === 'pause' ? 'Wallet paused durably.' : 'Wallet resumed explicitly.') })
