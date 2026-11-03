const byId = id => document.getElementById(id)
const status = text => { byId('status').textContent = text }
const action = async work => {
  try { await work() } catch { status('Action failed. Check Keychain access, provider setup, or Testnet connectivity. No credentials are logged.') }
}
void action(async () => {
  const state = await window.desktop.state()
  for (const key of ['live', 'paused']) byId(key).checked = state[key]
  for (const key of ['maxMinor', 'dailyMinor', 'walletDailyMinor']) byId(key).value = state[key]
  byId('paused').checked = state.wallet?.wallet?.paused ?? state.paused
  byId('backend').value = state.backend
  byId('remoteUrl').value = state.remoteUrl
  byId('walletDailyMinor').disabled = state.backend === 'remote'
  byId('walletStatus').textContent = state.wallet?.wallet ? `Wallet cap S$${(state.wallet.wallet.dailyMinor / 100).toFixed(2)} · gross spent S$${(state.wallet.wallet.spentMinor / 100).toFixed(2)} · ${state.wallet.wallet.paused ? 'paused' : 'active'}` : 'Backend unavailable; choose Local engine to recover.'
  status(`Ready · ${state.wallet?.labels.settlement ?? 'backend unavailable'} · cold start ${state.coldStartMs} ms`)
})
byId('credentials').onsubmit = event => {
  event.preventDefault()
  const value = byId('value').value; byId('value').value = ''
  void action(async () => { await window.desktop.secret(byId('account').value, value); status('Saved in macOS Keychain.') })
}
byId('wallets').onclick = () => void action(async () => {
  byId('wallets').disabled = true; status('Funding Testnet wallets. This can take a minute…')
  try { const wallets = await window.desktop.wallets(); status(`Testnet wallets saved in Keychain. Buyer: ${wallets[0].address}`) }
  finally { byId('wallets').disabled = false }
})
byId('mcp').onclick = () => void action(async () => { byId('command').textContent = await window.desktop.mcp(); status('MCP setup copied.') })
byId('apply').onclick = () => void action(() => window.desktop.save({ backend: byId('backend').value, remoteUrl: byId('remoteUrl').value, walletDailyMinor: Number(byId('walletDailyMinor').value), live: byId('live').checked, paused: byId('paused').checked, maxMinor: Number(byId('maxMinor').value), dailyMinor: Number(byId('dailyMinor').value) }))
