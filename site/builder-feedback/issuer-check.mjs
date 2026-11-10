// Public AccountRoot reads only. No signing library, wallet, transaction or backend.
export const LOCKING_FLAG = 0x40000000
export const ISSUERS = [
  { name: 'Testnet', account: 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV', server: 'wss://s.altnet.rippletest.net:51233', explorer: 'https://testnet.xrpl.org/accounts/' },
  { name: 'Mainnet', account: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De', server: 'wss://xrplcluster.com', explorer: 'https://livenet.xrpl.org/accounts/' },
]
export function parseAccountRoot(result, account) {
  const data = result?.account_data
  if (result?.validated !== true || data?.Account !== account || !Number.isInteger(data.Flags) || data.Flags < 0 || data.Flags > 0xffffffff || !Number.isInteger(result.ledger_index)) throw new Error('No validated AccountRoot received')
  return { enabled: (data.Flags & LOCKING_FLAG) !== 0, flags: data.Flags, ledger: result.ledger_index }
}
export function readIssuer(issuer, Socket = WebSocket, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const socket = new Socket(issuer.server)
    const finish = (error, value) => { clearTimeout(timer); socket.onclose = socket.onerror = socket.onmessage = socket.onopen = null; socket.close(); if (error) reject(error); else resolve(value) }
    const timer = setTimeout(() => finish(new Error('Public server timed out')), timeout)
    socket.onopen = () => socket.send(JSON.stringify({ id: 'issuer-permission', command: 'account_info', account: issuer.account, ledger_index: 'validated', strict: true }))
    socket.onerror = () => finish(new Error('Public server could not be reached'))
    socket.onclose = () => finish(new Error('Public server closed the connection'))
    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data)
        if (message.id !== 'issuer-permission') return
        if (message.status !== 'success') throw new Error('Public server did not return account information')
        finish(null, parseAccountRoot(message.result, issuer.account))
      } catch (error) { finish(error) }
    }
  })
}
if (typeof document !== 'undefined') {
  const button = document.getElementById('check-issuers'), results = document.getElementById('issuer-results')
  button?.addEventListener('click', async () => {
    button.disabled = true
    results.replaceChildren()
    await Promise.all(ISSUERS.map(async issuer => {
      const card = document.createElement('article'), title = document.createElement('h3'), link = document.createElement('a'), status = document.createElement('p')
      title.textContent = issuer.name; link.textContent = issuer.account; link.href = issuer.explorer + issuer.account
      status.textContent = 'Checking validated AccountRoot…'; card.append(title, link, status); results.append(card)
      try {
        const value = await readIssuer(issuer)
        status.textContent = `AllowTrustLineLocking: ${value.enabled ? 'ON · issuer permits token escrow' : 'OFF · issuer blocks token escrow'}. Flags ${value.flags} (0x${value.flags.toString(16)}). Validated ledger ${value.ledger}. Checked ${new Date().toISOString()}. Server: ${issuer.server}.`
      } catch {
        status.textContent = 'AllowTrustLineLocking: unknown · public server unavailable. No current result. Retry or inspect the issuer in the explorer.'
      }
    }))
    button.disabled = false
  })
}
