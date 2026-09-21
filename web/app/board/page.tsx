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


    </>
  );
}
