const STORAGE_KEY = "researchagent-uo04-prototype-v1";

const defaultState = {
  screen: "home",
  homeVariant: "first",
  question: "Compare the energy and cost trade-offs of liquid cooling for data-centre operations.",
  selectedProfiles: ["operations"],
  cap: 3,
  spent: 0,
  phase: "Evidence ready",
  paused: false,
  tab: "sources",
  sourceState: "recommended",
  purchaseModal: false,
  citationOpen: false,
  advanced: false,
  recovery: false,
  saved: false,
  activity: [
    { time: "Now", title: "Open evidence is ready", text: "Two fixture records can support an answer without a purchase." },
    { time: "Earlier", title: "Plan approved", text: "The approved mandate allows up to 3 XRP; no charge was created." },
  ],
};

let state = loadState();
let lastFocus = null;
let lastCitationId = null;
let toastTimer = null;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...defaultState, ...saved, purchaseModal: false, citationOpen: false } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, purchaseModal: false, citationOpen: false })); } catch { /* local-only demo */ }
}

function resetState() {
  state = structuredClone(defaultState);
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* local-only demo */ }
  announce("Prototype state reset. First-run home is ready.");
  render();
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function announce(message) {
  const live = document.querySelector("#live-region");
  if (live) live.textContent = message;
}

function notify(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3400);
  announce(message);
}

function commit(message) {
  saveState();
  render();
  if (message) notify(message);
}

function go(screen, message) {
  state.screen = screen;
  state.purchaseModal = false;
  state.citationOpen = false;
  if (screen !== "home") state.homeVariant = "returning";
  commit(message);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function stepper(current) {
  const steps = ["Question", "Sources", "Budget", "Review", "Research", "Answer"];
  const currentIndex = steps.indexOf(current);
  return `<ol class="stepper" aria-label="Research steps">${steps.map((label, index) => {
    const complete = currentIndex > index;
    const active = current === label;
    return `<li class="step ${active ? "current" : ""} ${complete ? "complete" : ""}" ${active ? 'aria-current="step"' : ""}>
      <span class="step-bullet" aria-hidden="true">${complete ? "✓" : index + 1}</span><span class="step-name">${label}</span>
    </li>`;
  }).join("")}</ol>`;
}

function layout(content, current) {
  return `<div class="flow-shell">${current ? stepper(current) : ""}${content}</div>`;
}

function homeView() {
  const returning = state.homeVariant === "returning" || state.saved;
  return `<div class="home-shell">
    ${returning ? `<section class="returning-card" aria-labelledby="return-title">
      <div><h2 id="return-title">Your research draft is ready</h2><p>Question, source choice, and the ${state.cap} XRP cap are preserved locally.</p></div>
      <button class="button primary" data-action="resume">Resume draft</button>
    </section>` : ""}
    <section class="home-hero">
      <div class="hero-copy">
        <p class="eyebrow">Deep research, with spending you control</p>
        <h1>Bring a hard question. Leave with an evidence trail.</h1>
        <p class="lead">ResearchAgent helps you move from a broad question to a clear, cited answer. Paid sources are optional and always require exact approval.</p>
        <div class="home-note"><span class="note-icon" aria-hidden="true">i</span><span>This local demo uses approved synthetic data-centre source profiles. It does not browse arbitrary domains or make real payments.</span></div>
      </div>
      <div class="composer-card">
        <label for="home-question">What would you like to investigate?</label>
        <textarea id="home-question" data-field="question" aria-describedby="home-question-help">${esc(state.question)}</textarea>
        <div id="home-question-help" class="composer-helper helper"><span>Try a supported data-centre comparison.</span><span>${state.question.length}/500</span></div>
        <div class="example-row" aria-label="Example questions">
          <button class="example" data-example="Compare the energy and cost trade-offs of liquid cooling for data-centre operations.">Liquid cooling trade-offs</button>
          <button class="example" data-example="Which cooling approach is most resilient for a high-density data-centre?>">Resilient operations</button>
          <button class="example" data-example="What should I cook for dinner tonight?">Unsupported example</button>
        </div>
        <div class="button-row">
          <button class="button primary" data-action="start-question">Start research <span aria-hidden="true">→</span></button>
          ${returning ? '<button class="button secondary" data-action="new-research">New research</button>' : '<button class="button ghost" data-action="show-returning">See returning-user state</button>'}
        </div>
      </div>
    </section>
    <section class="hero-card" aria-labelledby="how-title">
      <h2 id="how-title">How the guided path works</h2><p>Each step owns one decision. Your draft remains resumable as you go.</p>
      <div class="how-step"><span class="how-number">1</span><div><strong>Question + allowed sources</strong><span>Keep the question editable and choose named profiles the demo is allowed to read.</span></div></div>
      <div class="how-step"><span class="how-number">2</span><div><strong>Budget + readable plan</strong><span>Set a maximum spend. That cap is not a charge, wallet balance, or purchase consent.</span></div></div>
      <div class="how-step"><span class="how-number">3</span><div><strong>Research + answer</strong><span>Open evidence can answer directly. A premium recommendation is optional and separately approved.</span></div></div>
    </section>
    <p class="home-footer-note">Prototype behavior is simulated locally. Labels are intentionally explicit about fixture data and settlement simulation; no XRPL Testnet transaction is submitted or validated.</p>
  </div>`;
}

function questionView() {
  return layout(`<section class="single-card card-pad">
    <div class="screen-heading"><div><p class="screen-kicker">Question</p><h1>Start with one research question</h1><p>Edit the brief before choosing the evidence families that are allowed to support it.</p></div><button class="link-button back-link" data-action="home">Back to home</button></div>
    <label class="field-label" for="question-field">Your question</label>
    <textarea id="question-field" data-field="question" aria-describedby="question-help">${esc(state.question)}</textarea>
    <div id="question-help" class="composer-helper helper"><span>Supported demo scope: data-centre energy, cooling, and operations.</span><span>${state.question.length}/500</span></div>
    <div class="notice info"><strong>Allowed-to-read profiles</strong><span>Next, you will choose named fixture profiles. They are permitted evidence sources, not guarantees that every claim is true.</span></div>
    <div class="button-row"><button class="button primary" data-action="to-sources">Continue to sources <span aria-hidden="true">→</span></button><button class="button secondary" data-action="save-draft">Save draft</button></div>
  </section>`, "Question");
}

function unsupportedView() {
  return layout(`<section class="single-card card-pad">
    <div class="screen-heading"><div><p class="screen-kicker">Scope notice</p><h1>This question is outside the current demo</h1><p>Nothing was purchased and no research run was created.</p></div><span class="state-pill blocked">Unsupported scope</span></div>
    <div class="notice warning"><strong>We only have approved synthetic data-centre profiles here.</strong><span>That means we can demonstrate cooling, energy, and operations questions. Real-domain adapters are future scope, so unrelated fixture evidence will not be shown as an answer.</span></div>
    <dl class="definition-list"><div class="definition-row"><dt>Question kept</dt><dd>${esc(state.question)}</dd></div><div class="definition-row"><dt>Safe next action</dt><dd>Edit the question or return to the first-run composer.</dd></div></dl>
    <div class="button-row"><button class="button primary" data-action="edit-question">Edit question</button><button class="button secondary" data-action="home">Back to home</button></div>
  </section>`, "Question");
}

function sourcesView() {
  const profiles = [
    { id: "operations", name: "Operations & cooling briefs", desc: "Synthetic operator notes covering cooling approaches, energy load, and maintenance trade-offs.", family: "Operations", label: "Fixture profile" },
    { id: "energy", name: "Energy efficiency studies", desc: "Synthetic comparative records for power usage, heat rejection, and efficiency assumptions.", family: "Energy", label: "Fixture profile" },
    { id: "market", name: "Market context digest", desc: "Synthetic market notes that add context around implementation cost and adoption timing.", family: "Market context", label: "Optional context" },
  ];
  return layout(`<section class="single-card card-pad">
    <div class="screen-heading"><div><p class="screen-kicker">Sources</p><h1>Choose the profiles we may read</h1><p>Named profiles make the evidence boundary visible. This demo does not pretend to browse arbitrary domains.</p></div><button class="link-button back-link" data-action="back-question">Back</button></div>
    <div class="notice info"><strong>Trusted sources means allowed to read.</strong><span>Selected profiles are approved fixture inputs; they are not endorsements or guarantees of truth. You can inspect evidence and limitations later.</span></div>
    <div class="profile-list">${profiles.map((profile) => `<label class="profile-option ${state.selectedProfiles.includes(profile.id) ? "selected" : ""}"><input type="checkbox" data-profile="${profile.id}" ${state.selectedProfiles.includes(profile.id) ? "checked" : ""} /><span><strong>${profile.name}</strong><p>${profile.desc}</p><span class="profile-meta"><span class="tag allowed">Allowed to read</span><span class="tag">${profile.family}</span><span class="tag">${profile.label}</span></span></span></label>`).join("")}</div>
    <div class="selected-count"><span>Selected profiles</span><strong>${state.selectedProfiles.length} of 3</strong></div>
    ${state.selectedProfiles.length === 0 ? '<p class="field-error" role="alert">Choose at least one allowed profile before continuing.</p>' : ""}
    <div class="button-row"><button class="button primary" data-action="to-budget" ${state.selectedProfiles.length === 0 ? "disabled" : ""}>Continue to budget <span aria-hidden="true">→</span></button><button class="button secondary" data-action="save-draft">Save draft</button></div>
  </section>`, "Sources");
}

function budgetView() {
  const remaining = Math.max(0, state.cap - state.spent);
  return layout(`<section class="single-card card-pad">
    <div class="screen-heading"><div><p class="screen-kicker">Budget</p><h1>Set a maximum research spend</h1><p>Your cap guides the plan. It is not an immediate charge, wallet balance, or exact purchase consent.</p></div><button class="link-button back-link" data-action="back-sources">Back</button></div>
    <div class="budget-hero"><div><p class="mini-label">Maximum research spend</p><div class="budget-amount">${state.cap.toFixed(2)} <span>XRP</span></div></div><div class="helper">Fixture conversion<br /><strong>1 XRP ≈ S$10.00</strong><br />Approximation, not live FX</div></div>
    <div class="budget-control"><label class="field-label" for="cap-range">Maximum research spend: ${state.cap.toFixed(2)} XRP</label><div class="range-row"><input id="cap-range" type="range" min="0.5" max="8" step="0.25" value="${state.cap}" aria-valuetext="${state.cap.toFixed(2)} XRP maximum research spend" /><output class="range-output" for="cap-range">${state.cap.toFixed(2)} XRP</output></div></div>
    <div class="budget-grid"><div class="metric"><span class="mini-label">Cap</span><strong>${state.cap.toFixed(2)} XRP</strong><p>Server-validated mandate</p></div><div class="metric"><span class="mini-label">Spent</span><strong>${state.spent.toFixed(2)} XRP</strong><p>Actual approved purchases</p></div><div class="metric"><span class="mini-label">Remaining</span><strong>${remaining.toFixed(2)} XRP</strong><p>After approved spend</p></div></div>
    <div class="notice info"><strong>Wallet balance is separate</strong><span>Fixture wallet balance: 12.00 XRP. The cap does not represent funds held or reserved. A future live wallet would show its validated payer and network independently.</span></div>
    <dl class="definition-list"><div class="definition-row"><dt>Per-source ceiling</dt><dd>1.25 XRP <span class="muted-line">· system-owned safety limit</span></dd></div><div class="definition-row"><dt>Runtime / payment mode</dt><dd>Local fixture settlement simulation — no real publisher payment; no XRPL Testnet transaction submitted or validated</dd></div></dl>
    <div class="button-row"><button class="button primary" data-action="to-review">Continue to review <span aria-hidden="true">→</span></button><button class="button secondary" data-action="save-draft">Save draft</button></div>
  </section>`, "Budget");
}

function reviewView() {
  return layout(`<section class="single-card card-pad">
    <div class="screen-heading"><div><p class="screen-kicker">Review</p><h1>Check the plan before research starts</h1><p>One readable summary first. Technical controls stay available behind progressive disclosure.</p></div><button class="link-button back-link" data-action="back-budget">Back</button></div>
    <div class="summary-strip"><span><strong>Plan draft</strong> · fixture preview</span><span>Purchase: <strong>never implied</strong></span><span>Question: <strong>editable</strong></span></div>
    <dl class="definition-list" style="margin-top: 20px"><div class="definition-row"><dt>Question</dt><dd>${esc(state.question)}</dd></div><div class="definition-row"><dt>Selected families</dt><dd>${state.selectedProfiles.map((id) => ({ operations: "Operations & cooling", energy: "Energy efficiency", market: "Market context" }[id])).join(", ")}</dd></div><div class="definition-row"><dt>Maximum research spend</dt><dd>${state.cap.toFixed(2)} XRP <span class="muted-line">· cap only, not a charge</span></dd></div><div class="definition-row"><dt>Approach</dt><dd>Compare energy load, cooling trade-offs, implementation cost, and operational resilience using accessible fixture evidence.</dd></div><div class="definition-row"><dt>What the system may do</dt><dd>Read selected profiles, prepare a research plan, recommend an optional premium source, and answer from validated open evidence.</dd></div></dl>
    <details class="disclosure" ${state.advanced ? "open" : ""}><summary data-action="toggle-advanced">Edit advanced settings</summary><div class="advanced-grid"><div class="advanced-item"><strong>Stop condition</strong><span>Stop when evidence is sufficient or the cap is reached.</span></div><div class="advanced-item"><strong>Research horizon</strong><span>Demo-selected only; no arbitrary future year is prefilled.</span></div><div class="advanced-item"><strong>Technical limit</strong><span>Fixture retrieval and citation validation remain server-owned.</span></div><div class="advanced-item"><strong>Recovery</strong><span>Pause, reload reconciliation, and source-level recovery stay available.</span></div></div></details>
    <div class="notice success"><strong>Ready for plan approval</strong><span>Approving the plan starts research. It does not approve a purchase.</span></div>
    <div class="button-row"><button class="button primary" data-action="start-research">Approve plan &amp; start research <span aria-hidden="true">→</span></button><button class="button secondary" data-action="save-draft">Save draft and exit</button></div>
  </section>`, "Review");
}

function budgetStrip() {
  return `<div class="budget-strip"><div class="budget-strip-text"><span><strong>Cap</strong> ${state.cap.toFixed(2)} XRP</span><span><strong>Spent</strong> ${state.spent.toFixed(2)} XRP</span><span><strong>Remaining</strong> ${Math.max(0, state.cap - state.spent).toFixed(2)} XRP</span></div><span class="fixture-rate">≈ S$${(Math.max(0, state.cap - state.spent) * 10).toFixed(2)} remaining · fixture rate</span></div>`;
}

function sourceStateContent() {
  const status = state.sourceState;
  if (status === "unlocked") return `<span class="state-pill unlocked">Premium · unlocked</span>`;
  if (status === "blocked") return `<span class="state-pill blocked">Blocked · cap / policy</span>`;
  if (status === "expired") return `<span class="state-pill expired">Quote expired</span>`;
  if (status === "pending") return `<span class="state-pill pending">Payment outcome pending</span>`;
  if (status === "fulfillment") return `<span class="state-pill fulfillment">Access fulfilment failed</span>`;
  return `<span class="state-pill premium">Premium · optional</span>`;
}

function premiumAction() {
  const status = state.sourceState;
  if (status === "unlocked") return `<button class="button secondary" data-action="show-activity">View receipt</button>`;
  if (status === "blocked") return `<button class="button secondary" data-action="continue-without">Continue without it</button>`;
  if (status === "expired") return `<button class="button secondary" data-action="requote">Re-quote</button>`;
  if (status === "pending") return `<button class="button secondary" data-action="reconcile">Reconcile status</button>`;
  if (status === "fulfillment") return `<button class="button secondary" data-action="recover-access">Recover access</button>`;
  return `<button class="button secondary" data-action="open-purchase">Review purchase</button><button class="button ghost" data-action="skip-premium">Skip</button>`;
}

function sourceReason() {
  const status = state.sourceState;
  if (status === "blocked") return `<div class="notice danger"><strong>System-owned block.</strong><span>The quoted 1.10 XRP exceeds the remaining cap or per-source policy. No bypass is available; the open answer path remains safe.</span></div>`;
  if (status === "expired") return `<div class="notice warning"><strong>Quote expired without a charge.</strong><span>This old quote cannot be approved. Re-quote to receive a fresh server-bound amount.</span></div>`;
  if (status === "pending") return `<div class="notice info"><strong>Payment outcome is unresolved.</strong><span>Do not retry blindly. Reconcile the fixture settlement status before any further action.</span></div>`;
  if (status === "fulfillment") return `<div class="notice danger"><strong>Settlement and access are separate.</strong><span>The simulated settlement record is preserved, but protected evidence remains unavailable until access is verified.</span></div>`;
  return "";
}

function researchView() {
  const phaseText = state.paused ? "Paused · server state preserved" : "Evidence ready · open answer available";
  const sourceStatus = state.sourceState === "unlocked" ? "unlocked" : state.sourceState;
  return `<div class="workspace">
    ${state.recovery ? `<div class="recovery-banner"><span aria-hidden="true">↻</span><div><strong>Recovered after reload</strong><p>The authoritative fixture run is ready. Your question, source choices, cap, and receipts were preserved.</p></div><button class="button secondary" data-action="dismiss-recovery">Dismiss</button></div>` : ""}
    <div class="workspace-header"><div><p class="screen-kicker">Research workspace · R1</p><h1 class="workspace-question">${esc(state.question)}</h1><div class="phase-line"><span class="status-dot ${state.paused ? "paused" : ""}" aria-hidden="true"></span><span>${phaseText}</span><span>Plan approved</span></div></div><div class="workspace-actions"><button class="button secondary" data-action="toggle-pause">${state.paused ? "Resume" : "Pause"}</button><button class="button ghost" data-action="summary">Brief &amp; budget</button></div></div>
    ${budgetStrip()}
    <section class="progress-card" aria-labelledby="progress-title"><div class="progress-top"><h2 id="progress-title">Research progress</h2><span>${state.paused ? "Paused safely" : "Complete enough to answer"}</span></div><div class="progress-track" role="progressbar" aria-label="Research progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><div class="progress-fill"></div></div><p class="progress-copy">Open evidence is usable now. A premium article may add context, but it is optional and protected content stays unavailable until exact approval and verified access.</p></section>
    <div class="workspace-tabs" role="tablist" aria-label="Research details"><button class="tab ${state.tab === "sources" ? "active" : ""}" role="tab" aria-selected="${state.tab === "sources"}" data-tab="sources">Sources</button><button class="tab ${state.tab === "activity" ? "active" : ""}" role="tab" aria-selected="${state.tab === "activity"}" data-tab="activity">Activity</button></div>
    ${state.tab === "sources" ? `<div class="source-list" role="tabpanel">${sourceReason()}<div class="source-row"><div><div class="source-title-line"><h3>Cooling efficiency benchmark</h3><span class="state-pill open">Open · fixture</span></div><p class="source-description">Accessible record comparing liquid and air cooling under high-density workloads.</p><div class="source-meta"><span class="tag">Operations</span><span class="tag">Readable evidence</span><span class="tag">No purchase</span></div></div><div><p class="source-price"><strong>Open</strong><br />No charge</p><div class="source-actions"><button class="button secondary" data-action="inspect-open">Inspect evidence</button></div></div></div>
      <div class="recommendation"><h3>Optional premium recommendation</h3><p>This protected article may add implementation cost context. Recommendation is not approval; open evidence can still produce the answer.</p></div>
      <div class="source-row ${sourceStatus}"><div><div class="source-title-line"><h3>Datacentre cooling cost outlook</h3>${sourceStateContent()}</div><p class="source-description">Protected fixture article with a quote-bound excerpt on capital cost and deployment timing. The protected body is not shown before verified access.</p><div class="source-meta"><span class="tag">Market context</span><span class="tag">Protected content</span><span class="tag">Exact quote required</span></div></div><div><p class="source-price"><strong>1.10 XRP</strong><br />≈ S$11.00 · quoted</p><div class="source-actions">${premiumAction()}</div></div></div>
      <div class="answer-path"><div><h3>Answer from available evidence</h3><p>Two open fixture records are accessible, so no purchase is required to continue.</p></div><button class="button primary" data-action="open-answer">Open cited answer <span aria-hidden="true">→</span></button></div>
    </div>` : `<div class="single-card card-pad" role="tabpanel"><h2>Activity</h2><p class="helper" style="margin-top: 7px">Meaningful state transitions, receipts, skips, blocks, and recovery are kept here.</p><ul class="activity-list">${state.activity.map((item) => `<li class="activity-item"><span class="activity-time">${esc(item.time)}</span><div><strong>${esc(item.title)}</strong><p>${esc(item.text)}</p></div></li>`).join("")}</ul></div>`}
    <details class="scenario-box"><summary>Prototype controls · rehearse recovery states</summary><p class="helper" style="margin-top:8px">These local controls simulate state transitions; they never call a provider or payment API.</p><div class="scenario-buttons"><button class="button secondary" data-scenario="expired">Expire quote</button><button class="button secondary" data-scenario="blocked">Block by cap</button><button class="button secondary" data-scenario="pending">Unknown payment</button><button class="button secondary" data-scenario="fulfillment">Fail access</button><button class="button secondary" data-scenario="reload">Simulate reload</button></div></details>
  </div>${state.purchaseModal ? purchaseModal() : ""}`;
}

function purchaseModal() {
  lastFocus = document.activeElement;
  return `<div class="modal-backdrop" data-modal-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title"><div class="modal-header"><div><p class="screen-kicker">P2 · exact purchase review</p><h2 id="purchase-title">Review this optional purchase</h2></div><button class="modal-close" data-action="close-purchase" aria-label="Cancel purchase review">×</button></div><div class="modal-body"><p class="helper">Opening this review does not charge anything. Approval binds to this exact quote and is manually required.</p><div class="quote-card"><div class="quote-total"><div><span class="mini-label">Quoted amount</span><strong>1.10 XRP</strong></div><span>≈ S$11.00 fixture estimate</span></div><dl class="definition-list" style="margin-top:14px"><div class="definition-row"><dt>Source</dt><dd>Datacentre cooling cost outlook</dd></div><div class="definition-row"><dt>Why it may help</dt><dd>Adds protected cost-context evidence to the open cooling benchmark.</dd></div><div class="definition-row"><dt>After purchase</dt><dd>Cap ${state.cap.toFixed(2)} · Spent ${(state.spent + 1.1).toFixed(2)} · Remaining ${Math.max(0, state.cap - state.spent - 1.1).toFixed(2)} XRP</dd></div><div class="definition-row"><dt>Quote expires</dt><dd>In 04:52 · re-quote required after expiry</dd></div><div class="definition-row"><dt>Runtime / payment mode</dt><dd>Local fixture settlement simulation — no real publisher payment; no XRPL Testnet transaction submitted or validated</dd></div></dl></div><div class="notice warning"><strong>Protected-content terms</strong><span>Only the verified accessible excerpt may unlock. Settlement and access fulfilment are separate checks; a failure does not silently retry or expose the protected body.</span></div><p class="modal-note">This demo does not pay a real publisher. The fixture label is intentionally visible in every simulated receipt. If a future validated runtime uses XRPL Testnet, that environment would be labelled separately.</p><div class="modal-actions"><button class="button secondary" data-action="close-purchase">Cancel</button><button class="button primary" data-action="approve-purchase">Approve purchase of 1.10 XRP</button></div></div></section></div>`;
}

function answerView() {
  return `<div class="workspace"><div class="workspace-header"><div><p class="screen-kicker">Answer · A2 final cited answer</p><h1 class="workspace-question">${esc(state.question)}</h1><div class="phase-line"><span class="status-dot" aria-hidden="true"></span><span>Validated answer ready</span><span>Open evidence · fixture</span></div></div><div class="workspace-actions"><button class="button secondary" data-action="research">Back to research</button></div></div>${budgetStrip()}<article class="answer-card"><div class="answer-label"><span>Answer from available evidence</span><span class="state-pill open">Open · fixture</span></div><h1>Liquid cooling can reduce heat-management pressure, but the operating model matters as much as the hardware.</h1><p class="answer-summary">For a high-density data-centre, liquid cooling is most compelling when rack density and constrained air-handling capacity make conventional cooling expensive to scale. The trade-off is a more specialised maintenance and deployment model. The fixture evidence supports a conditional recommendation: pair liquid cooling with clear service procedures and measure energy savings against installation complexity.</p><h2>Uncertainty and limitations</h2><p class="helper" style="margin-top:7px">This is a deterministic fixture synthesis, not a live market forecast. It uses accessible open records only; the optional protected article was not required.</p><h2>Claim-level citations</h2><div class="citation-list"><div class="citation"><div><strong>High-density workloads increase the value of direct heat removal.</strong><span>Cooling efficiency benchmark · open fixture record</span></div><button class="button secondary" data-citation="cooling">View citation</button></div><div class="citation"><div><strong>Operational readiness determines whether the efficiency gain is durable.</strong><span>Operations &amp; cooling briefs · open fixture record</span></div><button class="button secondary" data-citation="operations">View citation</button></div></div><div class="answer-footer"><p>Evidence labels: open · fixture · validated citation</p><button class="button ghost" data-action="new-research">Start new research</button></div></article>${state.citationOpen ? citationDrawer() : ""}</div>`;
}

function citationDrawer() {
  const operations = state.citationOpen === "operations";
  return `<div class="drawer-backdrop" data-action="close-citation"></div><aside class="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="citation-title"><button class="modal-close drawer-close" data-action="close-citation" aria-label="Close citation inspection">×</button><p class="screen-kicker">Evidence inspection</p><h2 id="citation-title">${operations ? "Operations & cooling briefs" : "Cooling efficiency benchmark"}</h2><div class="evidence-quote">“${operations ? "A durable cooling program pairs energy targets with a service model that operators can maintain during routine intervention." : "As rack density rises, direct heat removal can reduce the pressure on conventional air-handling capacity."}”</div><div class="drawer-section"><h3>Access and evidence mode</h3><p>Open · fixture record · accessible before any purchase. This span is bound to the cited answer.</p></div><div class="drawer-section"><h3>Why this is shown</h3><p>Only validated, accessible spans become citations. Technical IDs and hashes stay behind this inspection layer.</p></div><div class="button-row"><button class="button primary" data-action="close-citation">Done</button></div></aside>`;
}

function render() {
  const app = document.querySelector("#app");
  if (!app) return;
  let html = state.screen === "home" ? homeView() : state.screen === "question" ? questionView() : state.screen === "unsupported" ? unsupportedView() : state.screen === "sources" ? sourcesView() : state.screen === "budget" ? budgetView() : state.screen === "review" ? reviewView() : state.screen === "answer" ? answerView() : researchView();
  app.innerHTML = html;
  if (state.purchaseModal) document.querySelector(".modal-close")?.focus();
  if (state.citationOpen) document.querySelector(".drawer-close")?.focus();
}

function updateQuestion(value) { state.question = value.slice(0, 500); saveState(); }

function isUnsupported(question) { return /\b(mars|recipe|dinner|football|weather|arbitrary|bitcoin)\b/i.test(question); }

function addActivity(title, text) { state.activity.unshift({ time: "Now", title, text }); state.activity = state.activity.slice(0, 7); }

document.addEventListener("input", (event) => {
  const field = event.target.closest('[data-field="question"]');
  if (field) updateQuestion(field.value);
  if (event.target.id === "cap-range") {
    state.cap = Number(event.target.value);
    saveState();
    render();
  }
});

document.addEventListener("change", (event) => {
  const profile = event.target.closest("[data-profile]");
  if (profile) {
    const id = profile.dataset.profile;
    state.selectedProfiles = profile.checked ? [...new Set([...state.selectedProfiles, id])] : state.selectedProfiles.filter((value) => value !== id);
    commit();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Tab" && (state.purchaseModal || state.citationOpen)) {
    const dialog = document.querySelector(state.purchaseModal ? ".modal[role=dialog]" : ".evidence-drawer[role=dialog]");
    const focusable = dialog ? [...dialog.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")].filter((element) => element.offsetParent !== null) : [];
    if (!focusable.length) { event.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!dialog.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return;
  }
  if (event.key !== "Escape") return;
  if (state.purchaseModal) { state.purchaseModal = false; commit("Purchase review cancelled; no state changed."); setTimeout(() => document.querySelector('[data-action="open-purchase"]')?.focus(), 0); return; }
  if (state.citationOpen) { state.citationOpen = false; render(); setTimeout(() => document.querySelector(`[data-citation="${lastCitationId || "cooling"}"]`)?.focus(), 0); }
});

document.addEventListener("click", (event) => {
  const example = event.target.closest("[data-example]");
  if (example) { state.question = example.dataset.example; render(); document.querySelector("#home-question")?.focus(); return; }
  const tab = event.target.closest("[data-tab]");
  if (tab) { state.tab = tab.dataset.tab; saveState(); render(); return; }
  const citation = event.target.closest("[data-citation]");
  if (citation) { state.citationOpen = citation.dataset.citation; lastCitationId = citation.dataset.citation; lastFocus = citation; render(); return; }
  const scenario = event.target.closest("[data-scenario]");
  if (scenario) { runScenario(scenario.dataset.scenario); return; }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  handleAction(action.dataset.action);
});

function runScenario(scenario) {
  if (scenario === "expired") { state.sourceState = "expired"; addActivity("Premium quote expired", "No charge was created; re-quote is required."); commit("Quote expired safely; nothing was charged."); }
  if (scenario === "blocked") { state.sourceState = "blocked"; addActivity("Premium source blocked", "System-owned cap or per-source policy; continue without it remains available."); commit("Premium source is blocked by policy; open evidence is unchanged."); }
  if (scenario === "pending") { state.sourceState = "pending"; addActivity("Payment outcome unresolved", "Reconciliation is required before any retry."); commit("Payment outcome is unresolved; reconcile before retrying."); }
  if (scenario === "fulfillment") { state.sourceState = "fulfillment"; addActivity("Access fulfilment needs recovery", "Settlement and protected access remain separate."); commit("Access fulfilment failed safely; protected evidence remains unavailable."); }
  if (scenario === "reload") { state.recovery = true; addActivity("Reload reconciled", "Authoritative fixture run restored with draft and receipts preserved."); commit("Reload recovery restored the authoritative fixture state."); }
}

function handleAction(action) {
  if (action === "reset") { resetState(); return; }
  if (action === "home") { state.screen = "home"; state.purchaseModal = false; state.citationOpen = false; saveState(); render(); return; }
  if (action === "show-returning") { state.homeVariant = "returning"; state.saved = true; saveState(); render(); announce("Returning-user resume state shown."); return; }
  if (action === "resume") { state.screen = "question"; state.homeVariant = "returning"; commit("Draft restored. Your question and budget are preserved."); return; }
  if (action === "new-research") { const preserved = { ...defaultState, question: "", homeVariant: "first" }; state = preserved; saveState(); render(); document.querySelector("#home-question")?.focus(); announce("New research composer ready."); return; }
  if (action === "start-question") { state.question = document.querySelector("#home-question")?.value?.trim() || state.question; if (isUnsupported(state.question)) go("unsupported", "Unsupported scope shown; no run or purchase was created."); else go("question", "Question saved. Next: choose allowed source profiles."); return; }
  if (action === "edit-question") { go("question"); return; }
  if (action === "to-sources") { if (isUnsupported(state.question)) go("unsupported", "Unsupported scope shown; no run or purchase was created."); else go("sources", "Sources step ready."); return; }
  if (action === "back-question") { go("question"); return; }
  if (action === "to-budget") { if (!state.selectedProfiles.length) { render(); announce("Choose at least one allowed profile."); } else go("budget", "Source profiles saved. Next: set the maximum research spend."); return; }
  if (action === "back-sources") { go("sources"); return; }
  if (action === "to-review") { go("review", "Budget saved as a cap, not a charge. Review the readable plan next."); return; }
  if (action === "back-budget") { go("budget"); return; }
  if (action === "toggle-advanced") { state.advanced = !state.advanced; saveState(); return; }
  if (action === "save-draft") { state.saved = true; state.homeVariant = "returning"; state.screen = "home"; state.purchaseModal = false; commit("Draft saved locally. Nothing was purchased."); return; }
  if (action === "start-research") { state.screen = "research"; state.phase = "Evidence ready"; state.paused = false; state.tab = "sources"; addActivity("Plan approved; research started", "The 3 XRP cap remains a mandate. No purchase was approved."); commit("Plan approved. Open evidence is ready; premium access remains optional."); return; }
  if (action === "toggle-pause") { state.paused = !state.paused; addActivity(state.paused ? "Research paused" : "Research resumed", state.paused ? "Question, cap, evidence, and receipts are preserved." : "Server-confirmed fixture phase resumed."); commit(state.paused ? "Research paused safely; state is preserved." : "Research resumed from the preserved state."); return; }
  if (action === "summary") { notify(`Brief & budget · cap ${state.cap.toFixed(2)} XRP · spent ${state.spent.toFixed(2)} XRP · remaining ${Math.max(0, state.cap - state.spent).toFixed(2)} XRP`); return; }
  if (action === "inspect-open") { state.citationOpen = "cooling"; state.screen = "answer"; render(); return; }
  if (action === "show-activity") { state.tab = "activity"; saveState(); render(); return; }
  if (action === "open-answer" || action === "continue-without") { state.screen = "answer"; state.tab = "sources"; addActivity("Answer opened from accessible evidence", "No purchase was required; citations are bound to open fixture spans."); commit("Cited open-only answer ready. No purchase required."); return; }
  if (action === "skip-premium") { addActivity("Premium source skipped", "Open evidence remains available; no purchase was created."); commit("Premium recommendation skipped; continuing with open evidence."); return; }
  if (action === "open-purchase") { lastFocus = document.activeElement; state.purchaseModal = true; render(); return; }
  if (action === "close-purchase") { state.purchaseModal = false; commit("Purchase review cancelled; no state changed."); setTimeout(() => document.querySelector('[data-action="open-purchase"]')?.focus(), 0); return; }
  if (action === "approve-purchase") { if (state.sourceState === "expired") { state.purchaseModal = false; commit("Quote expired before approval; no charge was created."); return; } state.sourceState = "unlocked"; state.spent = Number((state.spent + 1.1).toFixed(2)); state.purchaseModal = false; addActivity("Premium purchase approved", "1.10 XRP local fixture settlement simulated; no real publisher payment and no XRPL Testnet transaction submitted or validated; access verified."); commit("Exact purchase approved in simulation; protected excerpt is now unlocked."); return; }
  if (action === "requote") { state.sourceState = "recommended"; addActivity("Fresh premium quote ready", "The expired quote was discarded; review is required again."); commit("Fresh quote ready. Review it again before any approval."); return; }
  if (action === "reconcile") { state.sourceState = "recommended"; addActivity("Payment reconciled", "No settlement record was found; the source is still unpaid and locked."); commit("Reconciliation found no charge; source remains locked."); return; }
  if (action === "recover-access") { state.sourceState = "recommended"; addActivity("Access recovery complete", "The failed fulfilment was not retried automatically; source remains unpaid."); commit("Access recovery returned to a safe unpaid state."); return; }
  if (action === "dismiss-recovery") { state.recovery = false; commit("Recovery banner dismissed; reconciled state remains available."); return; }
  if (action === "research") { state.screen = "research"; state.citationOpen = false; saveState(); render(); return; }
  if (action === "close-citation") { state.citationOpen = false; render(); setTimeout(() => document.querySelector(`[data-citation="${lastCitationId || "cooling"}"]`)?.focus(), 0); return; }
}

render();
