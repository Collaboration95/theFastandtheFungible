// One stylesheet as a string so docker/bundle.mjs still produces a single publisher.mjs. Fluid: no fixed widths.
export const SITE_CSS = `
:root{--ink:#1c1c1a;--muted:#6f6e69;--line:#e7e5df;--bg:#fcfbf8;--accent:#2f6f5e}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.7 ui-sans-serif,"Avenir Next",Avenir,"Helvetica Neue",system-ui,sans-serif;overflow-wrap:anywhere}
a{color:inherit}
nav{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:1rem;max-width:56rem;margin:0 auto;padding:1.75rem 1.25rem}
nav .name{font-weight:600;text-decoration:none;letter-spacing:.01em}
nav .mid{display:flex;gap:1.75rem;justify-content:center}
nav .mid a,nav .right a{text-decoration:none;color:var(--muted)}
nav .mid a:hover,nav .right a:hover{color:var(--ink)}
nav .right{text-align:right}
main{max-width:40rem;margin:0 auto;padding:2rem 1.25rem 4rem}
.hero{text-align:center;font-size:clamp(1.4rem,4vw,2rem);line-height:1.35;font-weight:500;margin:3rem 0 4rem}
.hero small{display:block;margin-top:1rem;font-size:.85rem;font-weight:400;color:var(--muted)}
h1{font-size:clamp(1.6rem,5vw,2.4rem);line-height:1.2;font-weight:600;margin:.4rem 0 .6rem}
h2{font-size:1.25rem;margin:2.4rem 0 .6rem}
.kicker{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.by{color:var(--muted);margin:0 0 2rem}
.rows{list-style:none;margin:0;padding:0}
.rows li{display:flex;gap:1.5rem;padding:1rem 0;border-top:1px solid var(--line)}
.rows time{flex:0 0 7.5rem;color:var(--muted);font-variant-numeric:tabular-nums}
.rows a{text-decoration:none}.rows a:hover{text-decoration:underline}
.tag{font-size:.75rem;color:var(--muted);border:1px solid var(--line);border-radius:99px;padding:.05rem .55rem;margin-left:.4rem;white-space:nowrap}
.badge{display:inline-block;border:1px solid var(--accent);color:var(--accent);border-radius:6px;padding:.35rem .8rem;font-size:.9rem;margin:1rem 0}
.abstract{font-size:1.1rem}
.note{color:var(--muted)}
dl{display:grid;grid-template-columns:max-content 1fr;gap:.4rem 1.5rem}dt{color:var(--muted)}dd{margin:0}
:target{background:#f4efdc}
footer{max-width:40rem;margin:0 auto;padding:2rem 1.25rem 3rem;border-top:1px solid var(--line);color:var(--muted);font-size:.8rem;display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap}
@media(max-width:520px){nav{grid-template-columns:1fr 1fr}nav .mid{grid-column:1/-1;order:3}.rows li{flex-direction:column;gap:.1rem}dl{grid-template-columns:1fr}}
`
