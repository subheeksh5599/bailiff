"use client";

import "../board.css";
export default function Board() {
  return (
    <>
<header className="top">
  <svg className="mark" viewBox="0 0 170 48" aria-label="Bailiff">
    <path d="M4 22H18L24 15L30 28L37 4L43 35L48 20L54 26H72" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="3" y="45" fill="#fff" fontSize="29" fontWeight="800" letterSpacing="-1.1">bailiff</text>
  </svg>
  <span id="conn" className="conn">connecting…</span>
  <a className="btn ghost" href="./index.html">← site</a>
  <div className="status" id="status"></div>
</header>

<div id="banner" className="banner" style={{ display: "none" }}>
  <h3>Backend not reachable</h3>
  <p id="bannerDetail"></p>
  <div className="inline">
    <input id="urlInput" type="text" placeholder="http://127.0.0.1:3212" spellCheck="false"/>
    <button className="btn" id="urlSave">Connect</button>
  </div>
</div>

<div className="wrap">

  <div>
    <section className="card">
      <h2>New case</h2>
      <p className="hint">Paste the case text. Bailiff creates a real case, extracts the fields and keeps it open until the outcome is verified.</p>
      <label htmlFor="text">Case text</label>
      <textarea id="text" spellCheck="false" placeholder="Paste the email thread, order confirmation or portal export here."></textarea>
      <div className="row">
        <div><label htmlFor="label">Data label</label>
          <select id="label">
            <option value="TEST_INPUT">TEST_INPUT</option>
            <option value="SYNTHETIC_CONSENTED">SYNTHETIC_CONSENTED</option>
            <option value="UNLABELED">UNLABELED</option>
          </select></div>
        <div><label htmlFor="kind">Source</label>
          <select id="kind"><option value="text">text</option><option value="email">email</option></select></div>
      </div>
      <label htmlFor="urls">Requirement pages to read (one per line, optional)</label>
      <textarea id="urls" style={{ minHeight: "66px" }} spellCheck="false" placeholder="https://payer.example/prior-authorization"></textarea>
      <div className="row">
        <div><label htmlFor="rInsurer">Insurer email (optional)</label><input id="rInsurer" type="text" spellCheck="false"/></div>
        <div><label htmlFor="rSpecialist">Specialist email (optional)</label><input id="rSpecialist" type="text" spellCheck="false"/></div>
      </div>
      <p className="hint" style={{ margin: "12px 0 0" }}>Recipients must be real addresses. A case with none is blocked with <code>RECIPIENT_MISSING</code> rather than routed to an invented address.</p>
      <div style={{ marginTop: "14px" }}><button className="btn" id="create">Create case</button></div>
      <div className="msg" id="createMsg"></div>
    </section>

    <section className="card" style={{ marginTop: "16px" }}>
      <h2>Cases <span id="counts" style={{ fontWeight: "500", color: "#a7a4cf", fontSize: "13px" }}></span></h2>
      <p className="hint">Live from Convex — this list updates itself when a step or a reply lands.</p>
      <div className="filters" id="filters">
        <button data-f="all" className="on">all</button><button data-f="needs_action">needs action</button>
        <button data-f="waiting">waiting</button><button data-f="blocked">blocked</button>
        <button data-f="complete">complete</button>
      </div>
      <div className="clist" id="clist"><div className="empty">No cases in this session yet. Create one above.</div></div>
    </section>
  </div>

  <section className="card" id="detail">
    <p className="placeholder">Select a case, or create one, to see its evidence and what is still missing.</p>
  </section>
</div>

<script type="module">
import { ConvexClient } from "./convex-client.js";

/* Explicit function references: the Convex client accepts "module:function" strings. */
const anyApi = {
  sessions:     { ensure: "sessions:ensure" },
  cases:        { create: "cases:create", correctField: "cases:correctField",
                  setRecipients: "cases:setRecipients", retryStep: "cases:retryStep",
                  get: "cases:get", list: "cases:list", counts: "cases:counts" },
  integrations: { integrationStatus: "integrations:integrationStatus" },
  directory:    { list: "directory:list" }
};

const LS_URL = "bailiff.convexUrl", LS_TOK = "bailiff.session";

/* Backend resolution order:
   1. ?convex=<url>             explicit override, always wins
   2. localStorage              whatever was last saved from this page
   3. localhost when the page is served locally, otherwise the public backend
   The public default is a tunnel to the dev deployment, so the hosted page is usable
   from anywhere. It is a development backend carrying labelled test data. */
const PUBLIC_BACKEND = "https://dark-rooms-drop.loca.lt";
const LOCAL_BACKEND  = "http://127.0.0.1:3212";
const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const params = new URLSearchParams(location.search);
const url = params.get("convex")
         || localStorage.getItem(LS_URL)
         || (isLocal ? LOCAL_BACKEND : PUBLIC_BACKEND);
document.getElementById("urlInput").value = url;
document.getElementById("urlSave").onclick = () => {
  const v = document.getElementById("urlInput").value.trim().replace(/\/+$/,"");
  if (v) { localStorage.setItem(LS_URL, v); location.href = location.pathname; }
};

let token = localStorage.getItem(LS_TOK);
if (!token || token.length < 16) { token = crypto.randomUUID(); localStorage.setItem(LS_TOK, token); }

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const when = t => t ? new Date(t).toLocaleString() : "—";

function down(detail){
  $("conn").className = "conn down"; $("conn").textContent = "offline";
  $("banner").style.display = "block";
  $("bannerDetail").textContent = detail + "  This page talks to a Convex deployment at " + url +
    ". A deployment on 127.0.0.1 is only reachable from the machine running it; point this at a cloud deployment URL to use the board from anywhere.";
}

let client;
try { client = new ConvexClient(url); }
catch (e) { down("Could not construct a Convex client: " + e.message); throw e; }

/* A Convex client retries an unreachable deployment forever, so a dead backend would
   otherwise sit at "connecting…" with no explanation. Fail loudly after a deadline. */
let connected = false;
const deadline = setTimeout(() => {
  if (!connected && !client.connectionState?.().isWebSocketConnected) {
    down("The deployment did not answer within 12 seconds.");
  }
}, 12000);
function markUp(){
  if (connected) return;
  connected = true; clearTimeout(deadline);
  $("conn").className = "conn up"; $("conn").textContent = "live";
  $("banner").style.display = "none";
}

let selected = null, filter = "all", lastList = [];

/* ---- connection + integration status ---- */
(async () => {
  try {
    await client.mutation(anyApi.sessions.ensure, { token, label: "case board" });
    markUp();
  } catch (e) { down("The deployment did not accept a session: " + e.message + "."); return; }

  client.onUpdate(anyApi.integrations.integrationStatus, {}, rows => {
    $("status").innerHTML = (rows || []).map(r =>
      `<span className="hb" title="${esc(r.detail)}"><i className="dot ${esc(r.status)}"></i>${esc(r.name)} · ${esc(r.status.toLowerCase())}</span>`
    ).join("");
  }, err => console.warn("status", err));

  client.onUpdate(anyApi.cases.counts, { token }, c => {
    $("counts").textContent = c ? `· ${c.total} total · ${c.needsAction} need action · ${c.waiting} waiting · ${c.complete} complete` : "";
  }, () => {});

  subscribeList();
})();

/* ---- case list ---- */
let unsubList = null;
function subscribeList(){
  if (unsubList) unsubList();
  unsubList = client.onUpdate(anyApi.cases.list, { token, filter }, rows => {
    lastList = rows || [];
    if (!lastList.length) {
      $("clist").innerHTML = `<div className="empty">No cases match “${esc(filter)}”. Create one above.</div>`;
      return;
    }
    $("clist").innerHTML = lastList.map(r => `
      <button className="crow ${r.caseId === selected ? "sel" : ""}" data-id="${esc(r.caseId)}">
        <b>${esc(r.counterpartyDisplayName || r.caseRef)}</b>
        <small>${esc(r.caseRef)} · ${esc(r.state)}${r.requestedSpecialty ? " · " + esc(r.requestedSpecialty) : ""}</small>
        <small>${esc(r.nextAction || r.blockDetail || "")}</small>
      </button>`).join("");
    [...$("clist").querySelectorAll(".crow")].forEach(b =>
      b.onclick = () => selectCase(b.dataset.id));
    if (selected && !lastList.some(r => r.caseId === selected)) { /* keep detail open */ }
  }, err => console.warn("list", err));
}
$("filters").onclick = e => {
  const b = e.target.closest("button[data-f]"); if (!b) return;
  filter = b.dataset.f;
  [...$("filters").children].forEach(x => x.classList.toggle("on", x === b));
  subscribeList();
};

/* ---- create ---- */
$("create").onclick = async () => {
  const text = $("text").value.trim();
  const m = $("createMsg");
  if (text.length < 20) { m.className = "msg err"; m.textContent = "Paste the case text first (at least 20 characters)."; return; }
  const discoveryUrls = $("urls").value.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const recipients = {};
  if ($("rInsurer").value.trim())    recipients.insurer    = $("rInsurer").value.trim();
  if ($("rSpecialist").value.trim()) recipients.specialist = $("rSpecialist").value.trim();
  $("create").disabled = true; m.className = "msg"; m.textContent = "";
  try {
    const res = await client.mutation(anyApi.cases.create, { token, input: {
      kind: $("kind").value, text, label: $("label").value,
      ...(discoveryUrls.length ? { discoveryUrls } : {}),
      ...(Object.keys(recipients).length ? { recipients } : {})
    }});
    m.className = "msg ok";
    m.textContent = (res.duplicate ? "Identical case already existed — opened the existing case " : "Created ")
      + res.caseRef + " · state " + res.state
      + (res.extractionQueued ? " · extraction queued" : "")
      + (res.redactionKinds?.length ? " · redacted: " + res.redactionKinds.join(", ") : "")
      + (res.injectionSuspected ? " · prompt-injection suspected in source" : "");
    $("text").value = "";
    selectCase(res.caseId);
  } catch (e) { m.className = "msg err"; m.textContent = e.message || String(e); }
  finally { $("create").disabled = false; }
};

/* ---- detail ---- */
let unsubCase = null;
function selectCase(id){
  selected = id;
  [...$("clist").querySelectorAll(".crow")].forEach(b => b.classList.toggle("sel", b.dataset.id === id));
  if (unsubCase) unsubCase();
  unsubCase = client.onUpdate(anyApi.cases.get, { token, caseId: id }, d => renderCase(d),
    err => { $("detail").innerHTML = `<p className="placeholder">Could not load this case: ${esc(err.message)}</p>`; });
}

const fieldTag = s =>
  s === "PRESENT" ? '<span className="tag good">present</span>' :
  s === "MISSING" ? '<span className="tag bad">missing</span>' :
  s === "CORRECTED_BY_OPERATOR" ? '<span className="tag good">corrected by operator</span>' :
  `<span className="tag warn">${esc(String(s).toLowerCase())} · unconfirmed</span>`;

function renderCase(d){
  if (!d) { $("detail").innerHTML = `<p className="placeholder">Case not found for this session.</p>`; return; }
  const c = d.case || {}, comp = d.completion || {};
  const pct = comp.conditionsTotal ? Math.round(100 * comp.conditionsSatisfied / comp.conditionsTotal) : 0;
  const blocked = c.state === "BLOCKED" || c.state === "NEEDS_HUMAN";

  const sec = (title, note, body) =>
    `<div className="sec"><h3>${title}</h3>${note ? `<p className="note">${note}</p>` : ""}${body}</div>`;
  const list = (arr, fn, empty) =>
    (arr && arr.length) ? `<div className="items">${arr.map(fn).join("")}</div>` : `<p className="note">${empty}</p>`;

  $("detail").innerHTML = `
    <div className="inline" style={{ justifyContent: "space-between" }}>
      <div>
        <div className="inline"><span className="state ${esc(c.state)}">${esc(c.state)}</span>
          <span className="mono">${esc(d.caseRef)} · v${esc(d.stateVersion)}</span></div>
        <p className="note" style={{ margin: "8px 0 0" }}>${esc(d.nextAction || "No action queued.")}</p>
      </div>
      <div className="inline">
        ${["EXTRACT","DISCOVER","SUBMIT","READBACK"].map(s =>
          `<button className="btn ghost" data-retry="${s}">retry ${s.toLowerCase()}</button>`).join("")}
      </div>
    </div>

    ${blocked && c.blockDetail ? `<div className="banner" style={{ margin: "16px 0" }}><h3>${esc(c.blockCode || "BLOCKED")}</h3><p>${esc(c.blockDetail)}</p></div>` : ""}

    ${sec("Completion", "A case can only reach COMPLETE when read-back evidence satisfies every condition frozen at intake. There is no manual override.",
      `<div className="bar"><i style={{ width: "${pct}%" }}></i></div>
       <div className="kv"><div>Conditions</div><div>${comp.conditionsSatisfied ?? 0} of ${comp.conditionsTotal ?? 0} satisfied</div>
         <div>Completion allowed</div><div>${comp.completionAllowed ? '<span className="tag good">yes</span>' : '<span className="tag bad">no</span>'}</div>
         <div>Reason</div><div>${esc(comp.reason || "—")}</div></div>
       ${list(comp.missing, m => `<div className="item"><b>${esc(m.key)}</b><span className="tag">${esc(m.kind)}</span>
         <div className="sub">${esc(m.detail)} · satisfied by <b>${esc(m.evidenceType)}</b></div></div>`,
         "Nothing outstanding.")}`)}

    ${sec("Extraction", "Values marked ambiguous or contradictory were discarded by the validator and are shown as unconfirmed, not as facts.",
      d.extraction
        ? `<div className="items">${(d.extraction.fields || []).map(f => `<div className="item">
             <b>${esc(f.key ?? f.name ?? "field")}</b>${fieldTag(f.status)}
             <div className="sub">${esc(f.value ?? "—")}${f.quote ? ` · quote: “${esc(f.quote)}”` : ""}${f.confidence != null ? ` · confidence ${esc(f.confidence)}` : ""}</div>
           </div>`).join("")}</div>`
        : `<p className="note">No extraction yet. With no OpenAI key configured the deployment reports NOT_CONFIGURED rather than inventing fields.</p>`)}

    ${sec("Correct a field", "The only route out of NEEDS_HUMAN or BLOCKED after an uncertain extraction.",
      `<div className="row">
         <div><label htmlFor="cf">Field</label><select id="cf">
           ${["customer_name","case_sender","requested_outcome","priority","counterparty","received_date"]
             .map(f => `<option value="${f}">${f}</option>`).join("")}</select></div>
         <div><label htmlFor="cv">Value</label><input id="cv" type="text"/></div>
       </div>
       <div style={{ marginTop: "10px" }}><button className="btn" id="cfSave">Record correction</button></div>
       <div className="msg" id="cfMsg"></div>`)}

    ${sec("Recipients", "Real addresses only — never invented.",
      `<div className="row">
         <div><label htmlFor="riIns">Insurer</label><input id="riIns" type="text" value="${esc(c.recipients?.insurer || "")}"/></div>
         <div><label htmlFor="riSpec">Specialist</label><input id="riSpec" type="text" value="${esc(c.recipients?.specialist || "")}"/></div>
       </div>
       <div style={{ marginTop: "10px" }}><button className="btn" id="riSave">Save recipients</button></div>
       <div className="msg" id="riMsg"></div>`)}

    ${sec("Requirement sources", "A failed source is shown with its error code — a failure is not the same as “no requirements”.",
      list(d.requirementSources, s => `<div className="item"><b className="mono">${esc(s.url)}</b>
        <span className="tag ${s.status === "OK" ? "good" : "bad"}">${esc(s.status)}</span>
        <div className="sub">retrieved ${when(s.retrievedAt)}${s.errorCode ? " · " + esc(s.errorCode) : ""}${s.contentHash ? " · hash " + esc(String(s.contentHash).slice(0,16)) : ""}</div></div>`,
        "No requirement pages read for this case."))}

    ${sec("Frozen requirement sets", "The case is judged against the version frozen at intake, not against whatever the page says today.",
      list(d.requirementSets, r => `<div className="item"><b>v${esc(r.version)}</b>
        ${r.changedSincePrevious ? '<span className="tag warn">changed since previous</span>' : ""}
        <div className="sub">frozen ${when(r.frozenAt)} · ${(r.requirements || []).length} requirements</div></div>`,
        "No requirement set frozen yet."))}

    ${sec("Outbound effects", "SUBMITTED means an attempt left the building. EFFECTED means read-back proved the external object exists. They are not synonyms.",
      list(d.outgoingEffects, o => `<div className="item"><b>${esc(o.kind || "send")}</b>
        <span className="tag ${o.status === "EFFECTED" ? "good" : o.status === "FAILED" ? "bad" : "warn"}">${esc(o.status)}</span>
        <div className="sub">${esc(o.readback || o.detail || "")}</div></div>`,
        "Nothing sent yet."))}

    ${sec("Messages", "Previews are intentionally redacted by the backend.",
      list(d.messages, m => `<div className="item"><b>${esc(m.direction || "")} ${esc(m.to || m.from || "")}</b>
        <span className="tag">${esc(m.deliveryStatus || "—")}</span>
        <div className="sub">${esc(m.bodyPreview || "")} <span className="tag">redacted preview</span></div></div>`,
        "No messages on this case."))}

    ${sec("External confirmations", "Only accepted confirmations count toward completion.",
      list(d.confirmations, k => `<div className="item"><b>${esc(k.evidenceType || "confirmation")}</b>
        <span className="tag ${k.accepted ? "good" : "bad"}">${k.accepted ? "accepted" : "rejected"}</span>
        <div className="sub">${esc(k.rejectionReason || k.detail || "")} · ${when(k.receivedAt || k._creationTime)}</div></div>`,
        "No external confirmation read back yet — this is why the case stays open."))}

    ${sec("Timeline", "", list(d.timeline, t => `<div className="item"><b>${esc(t.to || t.state || "")}</b>
        <span className="tag">${esc(t.actor || "")}</span><span className="tag">v${esc(t.stateVersion)}</span>
        <div className="sub">${esc(t.reason || t.reasonCode || "")} · ${when(t.at)}</div></div>`, "No transitions recorded."))}

    <p className="legend">
      <code>SUBMITTED</code> an attempt left the building ·
      <code>EFFECTED</code> read-back proved the external object exists ·
      <code>COMPLETE</code> accepted evidence satisfied every frozen condition.<br/>
      There is deliberately no “mark complete” control on this page, because the backend exposes no API for it.
    </p>`;

  [...$("detail").querySelectorAll("[data-retry]")].forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await client.mutation(anyApi.cases.retryStep, { token, caseId: selected, step: b.dataset.retry }); }
    catch (e) { alert(e.message || String(e)); }
    finally { b.disabled = false; }
  });
  const cfSave = $("cfSave");
  if (cfSave) cfSave.onclick = async () => {
    const m = $("cfMsg");
    try {
      await client.mutation(anyApi.cases.correctField, { token, caseId: selected, field: $("cf").value, value: $("cv").value.trim() });
      m.className = "msg ok"; m.textContent = "Correction recorded as an OPERATOR revision.";
    } catch (e) { m.className = "msg err"; m.textContent = e.message || String(e); }
  };
  const riSave = $("riSave");
  if (riSave) riSave.onclick = async () => {
    const m = $("riMsg"), recipients = {};
    if ($("riIns").value.trim())  recipients.insurer    = $("riIns").value.trim();
    if ($("riSpec").value.trim()) recipients.specialist = $("riSpec").value.trim();
    try {
      await client.mutation(anyApi.cases.setRecipients, { token, caseId: selected, recipients });
      m.className = "msg ok"; m.textContent = "Recipients saved.";
    } catch (e) { m.className = "msg err"; m.textContent = e.message || String(e); }
  };
}
</script>
    </>
  );
}
