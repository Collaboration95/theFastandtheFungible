import { useEffect, useState } from 'react'

import { installLinks } from '../agent-install'
import './agent-connect.css'

export default function AgentConnect() {
  const [requiresBearer,setRequiresBearer] = useState(false)
  const [url,setUrl] = useState<string>(), [message,setMessage] = useState('Loading connection details…')
  useEffect(() => {
    const abort = new AbortController()
    void fetch('/api/connect',{signal:abort.signal}).then(async response => {
      if (!response.ok) throw Error()
      const body = await response.json()
      if (!body.url) { setMessage('URL access is not enabled on this server.'); return }
      const target = new URL(body.url)
      if (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(target.hostname))) throw Error()
      if (target.username || target.password || target.search || target.hash) throw Error()
      setRequiresBearer(body.requiresBearer === true);setUrl(target.href);setMessage('')
    }).catch(() => { if (!abort.signal.aborted) setMessage('Connection details are unavailable. Try again when the server responds.') })
    return () => abort.abort()
  },[])
  const copy = async (text:string) => { try { await navigator.clipboard.writeText(text);setMessage('Copied to the clipboard.') } catch { setMessage('Copy failed. Select and copy the displayed text.') } }
  const links = url ? installLinks(url) : undefined
  return <section aria-label="Connect by URL" className="ra-set ra-agent-connect">
    <h3>Connect by URL</h3>
    {links && url && <>
      <p><a href={links.cursor}>Add to Cursor</a> · <a href={links.vscode}>Add to VS Code</a></p>
      <h4>Claude</h4>
      <ol><li>Open Settings → Connectors.</li><li>Choose Add custom connector and paste this URL.</li></ol>
      <p><code>{url}</code> <button type="button" className="ra-btn" onClick={() => void copy(url)}>Copy URL</button></p>
      <h4>Claude Code</h4>
      <p><code>{links.claude}</code> <button type="button" className="ra-btn" onClick={() => void copy(links.claude)}>Copy command</button></p>
      {requiresBearer && <p>Your local server requires an agent bearer key. Add it in your client’s server settings.</p>}
      <p className="ra-note">{requiresBearer ? 'Uses your configured agent allowance.' : 'Anonymous clients on your public IP share the question allowance and access to these runs for 24 hours.'} Reuse the same request key when retrying a question.</p>
    </>}
    <p role="status">{message}</p>
  </section>
}
