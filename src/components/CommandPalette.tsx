import { useEffect, useRef, useState } from 'react'
export interface Command { id: string; label: string; hint?: string; run: () => void }
/** Native modal owns focus, Escape, and return focus. No command can purchase. */
export default function CommandPalette({ commands, onClose, sheet = false }: { commands: Command[]; onClose: () => void; sheet?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const list = commands.filter(command => command.label.toLowerCase().includes(query.toLowerCase()))
  useEffect(() => { const element = dialog.current; element?.showModal(); element?.querySelector('input')?.focus(); return () => element?.close() }, [])
  const choose = (command?: Command) => { if (command) { dialog.current?.close(); onClose(); requestAnimationFrame(() => command.run()) } }
  return <dialog ref={dialog} className="ra-command" aria-label={sheet ? 'Keyboard shortcuts' : 'Command palette'} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === dialog.current) onClose() }} onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setSelected(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % (list.length || 1)) }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); choose(list[selected]) }
  }}>
    <header><h2>{sheet ? 'Keyboard shortcuts' : 'Commands'}</h2><button className="ra-link" onClick={onClose}>Close <kbd>Esc</kbd></button></header>
    <label className="ra-sr" htmlFor="command-search">Find a command</label>
    <input autoFocus id="command-search" autoComplete="off" placeholder="Find a command…" value={query} onChange={event => { setQuery(event.target.value); setSelected(0) }} aria-controls="command-results" aria-activedescendant={list[selected]?.id} role="combobox" aria-expanded="true" aria-autocomplete="list" />
    <ul id="command-results" role="listbox" aria-label="Commands">{list.map((command, index) => <li key={command.id} id={command.id} role="option" aria-selected={index === selected}><button tabIndex={-1} onClick={() => choose(command)}><span>{command.label}</span>{command.hint && <kbd>{command.hint}</kbd>}</button></li>)}</ul>
    {!list.length && <p role="status">No matching commands.</p>}
    <footer>↑ ↓ to choose · Enter to run · Esc to close</footer>
  </dialog>
}
