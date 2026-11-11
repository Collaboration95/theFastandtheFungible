export type ReplayEntry = readonly [scenario: string, runId: string, chunk: string, question: string, label: string, shortLabel: string]

/** Serialized into the built HTML: no imports or recording bodies at runtime. */
export function replayLoadingShell(recordings: readonly ReplayEntry[]) {
  const params = new URLSearchParams(location.search)
  const selected = recordings.find(row => row[0] === params.get('scenario'))
    ?? recordings.find(row => row[1] === params.get('run'))
    ?? recordings.find(row => row[0] === 'UC3-key-reveal')!
  const preload = document.createElement('link')
  preload.rel = 'modulepreload'
  preload.crossOrigin = ''
  preload.href = '/theFastandtheFungible/demo/' + selected[2]
  document.head.append(preload)
  // Interactive fires after parsing, before deferred app execution. Waiting for
  // DOMContentLoaded would also wait for the module dependencies we are loading.
  document.addEventListener('readystatechange', () => {
    if (params.has('writers')) return
    const root = document.getElementById('root')!
    root.innerHTML = '<div class="ra-app"><div class="ra-body"><div class="ra-nav is-rail" aria-hidden="true"></div><div class="ra-ws"><main id="main" tabindex="-1" class="ra-brief demo-loading" aria-busy="true"><h1 class="ra-q"></h1><p role="status">Loading recorded run…</p></main></div></div></div>'
    const nav = root.querySelector('.ra-nav')!
    const narrow = matchMedia('(max-width: 780px)').matches
    document.querySelector<HTMLDetailsElement>('.demo-shell')!.open = !narrow
    let rail = narrow || params.get('record') === '1'
    // Match the app's saved sidebar geometry, including denied storage access.
    try {
      rail ||= localStorage.getItem('researchagent.nav') === 'rail'
      const width = Number(localStorage.getItem('researchagent.nav-width'))
      if (width >= 200 && width <= 420) root.querySelector<HTMLElement>('.ra-body')!.style.setProperty('--nav-w', width + 'px')
    } catch { /* The default sidebar width is already supplied by the app CSS. */ }
    nav.classList.toggle('is-rail', rail)
    root.querySelector('h1')!.textContent = selected[3]
    document.querySelectorAll('.demo-label').forEach(label => { label.textContent = selected[4] })
    document.querySelector('.demo-short')!.textContent = selected[5]
  }, { once: true })
}
