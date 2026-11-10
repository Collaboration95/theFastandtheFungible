import { useEffect, useRef, useState } from 'react'
export interface Command { id: string; label: string; hint?: string; group?: string; run: () => void }
/** Native modal owns focus, Escape, and return focus. No command can purchase. */
export default function CommandPalette({ commands, onClose, sheet = false }: { commands: Command[]; onClose: () => void; sheet?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const grouped = [...commands].sort((a,b) => ['Actions','Examples','Recent runs'].indexOf(a.group ?? 'Actions') - ['Actions','Examples','Recent runs'].indexOf(b.group ?? 'Actions'))
  const list = grouped.filter(command => (command.label + ' ' + command.id.replace('cmd-', '')).toLowerCase().includes(query.toLowerCase().replace(/ ·$/, '')))
  useEffect(() => { const element = dialog.current; element?.showModal(); element?.querySelector('input')?.focus(); return () => element?.close() }, [])
  const choose = (command?: Command) => { if (command) { dialog.current?.close(); onClose(); requestAnimationFrame(() => command.run()) } }
  return <dialog ref={dialog} className="ra-command" aria-label={sheet ? 'Keyboard shortcuts' : 'Command palette'} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === dialog.current) onClose() }} onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setSelected(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % (list.length || 1)) }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); choose(list[selected]) }
  }}>

    <label className="ra-sr" htmlFor="command-search">Find a command</label>
    <input autoFocus id="command-search" autoComplete="off" placeholder="Search actions, runs and examples" value={query} onChange={event => { setQuery(event.target.value); setSelected(0) }} aria-controls="command-results" aria-activedescendant={list[selected]?.id} role="combobox" aria-expanded="true" aria-autocomplete="list" />
    <ul id="command-results" role="listbox" aria-label="Commands">{list.map((command, index) => <li key={command.id} id={command.id} role="option" aria-selected={index === selected} onMouseDown={event => event.preventDefault()} onClick={() => choose(command)}><span>{(index === 0 || list[index - 1].group !== command.group) && <small className="ra-command-group">{command.group ?? 'Actions'}</small>}{command.label}</span>{command.hint && <kbd>{command.hint}</kbd>}</li>)}</ul>
    {!list.length && <p role="status">No matching commands.</p>}
    <footer>↑ ↓ to choose · Enter to run · Esc to close</footer>
  </dialog>
}
