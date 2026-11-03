for (const operation of ['settings', 'retry', 'offline']) document.getElementById(operation).onclick = async () => {
  try { await window.desktop.recover(operation); document.getElementById('status').textContent = operation === 'settings' ? 'Settings opened.' : 'Starting engine…' }
  catch { document.getElementById('status').textContent = 'Recovery is busy. Please retry.' }
}
