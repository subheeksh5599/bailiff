"use client";

import type { CSSProperties } from "react";

import "./globals.css";
import Script from "next/script";

export default function Landing() {
  return (
    <>
<header className="nav" id="nav"><div className="wrap">
  <a className="mark" href="#top" aria-label="Bailiff">
    <svg viewBox="0 0 170 48"><path className="ecg" d="M4 22H18L24 15L30 28L37 4L43 35L48 20L54 26H72"/><circle cx="4" cy="22" r="2.4" fill="#fff"/><circle cx="72" cy="26" r="2.4" fill="#fff"/><text x="3" y="45" fill="#fff" fontSize="29" fontWeight="800" letterSpacing="-1.1" fontFamily="Manrope">bailiff</text></svg>
  </a>
  <nav className="nav-links">
    <span>Our Solutions &#8964;</span><span>Who We Serve &#8964;</span>
    <a href="#glove">About Us</a>
    <a href="#article">Blog</a>
    <a href="#integrations">SDK</a>
    <a href="#integrations">Docs</a>
  </nav>
  <a className="pill pill-white" href="board/index.html">Request Demo</a>
</div></header>

<main id="top">

{/* ================= HERO PINNED SCENE ================= */}
<section className="scene" id="scene"><div className="stick">
  <div className="glow"></div>

  <div className="hero-art" id="heroArt"><svg viewBox="0 0 460 720" aria-hidden="true">
    <rect className="ln" x="52" y="36" width="236" height="292" rx="26"/>
    <rect className="ln" x="76" y="64" width="188" height="164" rx="13" strokeDasharray="5 5"/>
    <path className="ln ln-c" d="M88 164Q128 126 166 158T228 122T262 142"/>
    <rect className="ln" x="104" y="250" width="132" height="10" rx="5"/>
    <rect className="ln" x="104" y="272" width="88" height="10" rx="5"/>
    <path className="ln" d="M0 418C84 418 90 498 188 498C276 498 312 408 282 340C258 276 184 290 188 368C193 442 282 448 346 398C400 358 420 290 456 250"/>
    <circle className="ln" cx="442" cy="250" r="27"/><circle className="ln ln-c" cx="442" cy="250" r="13"/>
    <path className="ln" d="M330 96v66a22 22 0 0 0 44 0V96"/><rect className="ln" x="326" y="70" width="52" height="28" rx="12"/>
    <ellipse className="ln" cx="120" cy="612" rx="34" ry="17" transform="rotate(-24 120 612)"/>
    <ellipse className="ln" cx="176" cy="642" rx="34" ry="17" transform="rotate(-24 176 642)"/>
    <path className="ln" d="M240 600h120M240 626h84M240 652h104"/>
  </svg></div>

  <div className="hero-copy" id="heroCopy">
    <h1>Making every<br/>outcome<br/><span className="kw" id="kw"><span className="kwW on">verified.</span><span className="kwW">accountable.</span><span className="kwW">complete.</span></span></h1>
    <p>Case tracking that stays open until the other side's own record confirms it.</p>
  </div>

  <div className="dash-wrap" id="dashWrap"><div className="dash">
    <aside className="d-side">
      <svg className="mark" viewBox="0 0 170 48"><path className="ecg" d="M4 22H18L24 15L30 28L37 4L43 35L48 20L54 26H72"/><text x="3" y="45" fill="#fff" fontSize="29" fontWeight="800" letterSpacing="-1.1" fontFamily="Manrope">bailiff</text></svg>
      <h3>Louise Belrosa</h3><small>CASE SR-4471 &middot; opened 12 days ago</small>
      <div className="d-rule"></div>
      <div className="d-meta">
        <div><b>Opened by</b>Example Org</div>
        <div><b>Counterparty</b>Example Corp</div>
        <div><b>Owed</b>$412 refund<br/>Salt Lake City, Utah</div>
      </div>
      <div className="d-cap">Example case &mdash; timeline</div>
      <div className="d-bill">
        <div><span>Case opened</span><span>day 0</span></div>
        <div><span>Requirements frozen</span><span>day 0</span></div>
        <div><span>Payer approved</span><span>day 6</span></div>
        <div><span>Handoff confirmed</span><span>pending</span></div>
      </div>
    </aside>
    <div className="d-main">
      <div className="d-nav"><span>Case</span><span>Requirements</span><span>Messages</span><span className="on">Evidence</span></div>
      <div className="d-tabs">
        <span className="on">Delivery proof</span><span>Order reference</span><span>Refund receipt</span>
        <span>Insurance card</span><span>Consent</span><span>Handoff receipt</span>
      </div>
      <div className="d-card">
        <div className="d-head">
          <div><b>Completion evidence</b><h4>Confirmations received</h4><small>4 required for this case</small></div>
          <div className="d-val"><span id="sys">1</span> / <span id="dia">4</span> <i>case open</i></div>
        </div>
        <div className="d-chartlbl">Case activity record</div>
        <svg className="d-chart" viewBox="0 0 700 150" preserveAspectRatio="none">
          <line className="grid" x1="0" x2="700" y1="34" y2="34"/><line className="grid" x1="0" x2="700" y1="76" y2="76"/><line className="grid" x1="0" x2="700" y1="118" y2="118"/>
          <g className="bar">
            <line x1="40" y1="38" x2="40" y2="104"/><line x1="100" y1="46" x2="100" y2="112"/>
            <line x1="160" y1="30" x2="160" y2="96"/><line x1="220" y1="52" x2="220" y2="116"/>
            <line x1="280" y1="36" x2="280" y2="98"/><line x1="340" y1="44" x2="340" y2="110"/>
            <line x1="400" y1="26" x2="400" y2="92"/><line x1="460" y1="48" x2="460" y2="114"/>
            <line x1="520" y1="34" x2="520" y2="100"/><line x1="580" y1="42" x2="580" y2="106"/>
            <line x1="640" y1="30" x2="640" y2="94"/>
          </g>
          <path className="trend" id="trend" d="M40 70Q100 82 160 62T280 68T400 46T520 66T640 56"/>
        </svg>
        <div className="d-axis"><span>day 0</span><span>day 2</span><span>day 4</span><span>day 6</span><span>day 8</span><span>day 10</span><span>day 12</span></div>
      </div>
    </div>
  </div></div>

  <div className="focus" id="focus">
    <h2>Sent is not the same<br/>as complete</h2>
    <div className="ecg-pill"><span>KEEP SCROLLING</span>
      <svg viewBox="0 0 54 14"><path d="M0 7H14L18 1L22 13L26 7L30 10L34 7H54"/></svg><span>&#8595;</span></div>
  </div>
</div></section>

{/* ================= LIGHT CTA + TRAVELLING PILL ================= */}
<section className="cta-band" id="ctaBand">
  <div className="cta-line">
    <span>Let&rsquo;s show you</span>
    <span id="pillSlot" aria-hidden="true"></span>
    <span>how we do it</span>
  </div>
</section>
<a id="demoPill" href="board/index.html">Request Demo</a>

{/* ================= PROCESS ================= */}
<section className="process" id="process"><div className="wrap">

  <article className="step" data-step>
    <div className="step-copy">
      <div className="glyph"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg></div>
      <h2>First, Bailiff <i>extracts</i> <u>and validates</u> what the case requires.</h2>
      <p>Paste the case or upload the PDF. Bailiff pulls out the structured facts, flags what is missing, and freezes the requirement set that this case will be judged against.</p>
      <a className="more" href="#integrations">&#8594; See how a case is verified</a>
    </div>
    <div className="panel"><div className="art"><svg viewBox="0 0 460 330">
      <rect className="ln ln-c draw" style={{ "--len": "1200" } as CSSProperties} x="70" y="34" width="330" height="188" rx="16"/>
      <g className="ln ln-c draw" style={{ "--len": "900" } as CSSProperties}>
        <path d="M70 76h330M70 114h330M70 152h330M70 190h330M168 34v188"/>
      </g>
      <rect className="chip" x="212" y="18" width="206" height="38" rx="19"/>
      <text className="chiptx" x="230" y="42">Rayna Donin | prior auth missing</text>
      <rect className="chip" x="146" y="196" width="196" height="38" rx="19"/>
      <text className="chiptx" x="164" y="220">Case intake | example</text>
      <g className="ln ln-c draw" style={{ "--len": "700" } as CSSProperties} transform="translate(52 236)">
        <circle cx="34" cy="22" r="17"/><path d="M4 66a30 30 0 0 1 60 0"/>
      </g>
      <path className="ln ln-c draw" style={{ "--len": "400" } as CSSProperties} d="M300 262h96M300 284h64"/>
    </svg></div></div>
  </article>

  <article className="step" data-step>
    <div className="step-copy">
      <div className="glyph"><svg viewBox="0 0 24 24"><path d="M3 8l9-4 9 4v8l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v8"/></svg></div>
      <h2>We <i>read</i> the <i>current</i> payer and specialist requirements, then <u>version</u> them.</h2>
      <p>Requirements change without notice. Bailiff reads the live payer and specialist pages at intake and records exactly which version the case was checked against, so any decision can be audited later.</p>
      <a className="more" href="#integrations">&#8594; See how a case is verified</a>
    </div>
    <div className="panel"><div className="art"><svg viewBox="0 0 460 330">
      <rect className="ln ln-c draw" style={{ "--len": "1100" } as CSSProperties} x="150" y="16" width="168" height="196" rx="26"/>
      <rect className="ln ln-c draw" style={{ "--len": "600" } as CSSProperties} x="180" y="44" width="108" height="46" rx="11"/>
      <text className="bigval" x="234" y="80" textAnchor="middle">v4</text>
      <text className="lbl" x="284" y="88">REQ SET</text>
      <path className="ln ln-c draw" style={{ "--len": "500" } as CSSProperties} d="M330 22l-54 56M330 22l16 16-54 56-16-16z"/>
      <g transform="translate(148 214)">
        <rect className="ln ln-c draw" style={{ "--len": "800" } as CSSProperties} x="0" y="0" width="150" height="62" rx="12"/>
        <text className="mini" x="20" y="38">3 sources read</text>
        <path className="ln ln-c draw" style={{ "--len": "600" } as CSSProperties} d="M150 34c56 0 70 46 24 64s-98-10-112-46"/>
      </g>
      <path className="ln ln-c draw" style={{ "--len": "500" } as CSSProperties} d="M60 118c0 54 22 86 62 96M60 118a12 12 0 1 1 24 0"/>
    </svg></div></div>
  </article>

  <article className="step" data-step>
    <div className="step-copy">
      <div className="glyph"><svg viewBox="0 0 24 24"><path d="M3 18V8M9 18V4M15 18v-7M21 18V6"/></svg></div>
      <h2>Bailiff <i>sends</i> the real follow-up and <u>records every reply</u> against the case.</h2>
      <p>Chasing a company is email work. Bailiff sends the next message to the vendor or its support desk, reads what comes back, and attaches each reply to the case as evidence instead of leaving it in someone's inbox.</p>
      <a className="more" href="#integrations">&#8594; See how a case is verified</a>
    </div>
    <div className="panel"><div className="art"><svg viewBox="0 0 460 330">
      <rect className="ln ln-c draw" style={{ "--len": "1000" } as CSSProperties} x="96" y="14" width="330" height="116" rx="16"/>
      <text className="lbl" x="120" y="44">REPLIES RECORDED</text>
      <text className="rowtx" x="120" y="60">across 12 days on this case</text>
      <text className="bigval" x="120" y="108">12</text>
      <rect className="ln ln-c draw" style={{ "--len": "1000" } as CSSProperties} x="96" y="148" width="330" height="148" rx="16"/>
      <text className="lbl" x="120" y="176">RESPONSE LATENCY</text>
      <path d="M116 268Q166 232 206 250T286 226T406 200V286H116Z" fill="rgba(0,177,255,.22)"/>
      <path className="ln ln-c draw" style={{ "--len": "700" } as CSSProperties} d="M116 268Q166 232 206 250T286 226T406 200"/>
      <g className="ln ln-c draw" style={{ "--len": "600" } as CSSProperties} transform="translate(28 46)">
        <rect x="0" y="0" width="46" height="34" rx="12"/><path d="M8 34v14a15 15 0 0 0 30 0V34"/>
      </g>
      <path className="ln ln-c draw" style={{ "--len": "400" } as CSSProperties} d="M42 168v104M34 272h16"/>
      <ellipse className="ln ln-c draw" style={{ "--len": "300" } as CSSProperties} cx="44" cy="302" rx="22" ry="11" transform="rotate(-22 44 302)"/>
    </svg></div></div>
  </article>

  <article className="step" data-step>
    <div className="step-copy">
      <div className="glyph"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M9 9v11"/></svg></div>
      <h2>A case closes on <u>confirmed handoffs</u>, <i>not on sent messages</i>, and never on a guess.</h2>
      <p>Every open case shows what is still missing and who owes it. A case can only reach complete when the other side's own record has actually been read back and matches the requirements frozen at intake.</p>
      <a className="more" href="#integrations">&#8594; See how a case is verified</a>
    </div>
    <div className="panel"><div className="art"><svg viewBox="0 0 460 330">
      <rect className="ln ln-c draw" style={{ "--len": "1300" } as CSSProperties} x="24" y="12" width="412" height="230" rx="16"/>
      <text className="lbl" x="44" y="40">CUSTOMER</text><text className="lbl" x="200" y="40">CASE STATUS</text><text className="lbl" x="344" y="40">DAYS OPEN</text>
      <path className="ln ln-c draw" style={{ "--len": "1400" } as CSSProperties} d="M24 52h412M24 84h412M24 116h412M24 148h412M24 180h412M24 212h412"/>
      <g className="rowtx">
        <text x="44" y="73">Doris Phillips</text><text x="200" y="73">Confirmed</text><text x="346" y="73">4</text>
        <text x="44" y="105">Rayna Dorwart</text><text x="200" y="105">Confirmed</text><text x="346" y="105">6</text>
        <text x="44" y="137">Adison Geidt</text><text x="200" y="137">Confirmed</text><text x="346" y="137">3</text>
        <text className="hi" x="44" y="169">Corey Bergson</text><text className="hi" x="200" y="169">Awaiting</text><text className="hi" x="346" y="169">12</text>
        <text x="44" y="201">Terry Lubin</text><text x="200" y="201">Confirmed</text><text x="346" y="201">5</text>
        <text x="44" y="233">Omar Baptista</text><text x="200" y="233">Confirmed</text><text x="346" y="233">8</text>
      </g>
      <g fill="rgba(177,166,246,.24)" stroke="#b1a6f6" strokeWidth="1">
        <rect x="384" y="60" width="44" height="18" rx="9"/><rect x="384" y="92" width="44" height="18" rx="9"/>
        <rect x="384" y="124" width="44" height="18" rx="9"/><rect x="384" y="156" width="44" height="18" rx="9"/>
        <rect x="384" y="188" width="44" height="18" rx="9"/><rect x="384" y="220" width="44" height="18" rx="9"/>
      </g>
      <g className="ln ln-c draw" style={{ "--len": "700" } as CSSProperties} transform="translate(120 250)">
        <path d="M0 40L110 0l110 40-110 40z"/><path d="M0 40v26l110 40 110-40V40"/>
      </g>
    </svg></div></div>
  </article>

</div></section>

{/* ================= WHITE GLOVE ================= */}
<section className="light" id="glove">
  <div className="wrap">
    <div className="eyebrow rv">evidence, not trust</div>
    <h2 className="rv">Every case carries its own evidence</h2>
    <p className="sub rv">Nothing is marked complete on trust. Each state change is stored with the reply, the timestamp and the requirement version it satisfied.</p>
    <div className="badge-box rv">
      <div className="seal">
        <svg viewBox="0 0 96 96" fill="none" stroke="#16165c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M48 6l34 14v26c0 25-16 38-34 44C30 84 14 71 14 46V20z"/><path d="M33 47l10 11 21-23"/>
        </svg>
        <small>EVIDENCE SEAL</small><strong>Signed receipts</strong><small>Every claim sourced</small>
      </div>
      <div className="seal">
        <svg viewBox="0 0 96 96" fill="none" stroke="#16165c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="48" cy="48" r="38"/><circle cx="48" cy="48" r="28"/>
          <text x="48" y="54" textAnchor="middle" fontSize="17" fontWeight="800" fill="#16165c" stroke="none" fontFamily="Manrope">SOC 2</text>
        </svg>
        <small>CERTIFIED SECURITY</small><strong>SOC 2 Type II</strong><small>Secure by design</small>
      </div>
    </div>
    <p className="fine rv">Bailiff records where every claim on a case came from, and signs the run that closed it. The seal shown is our own receipt for a case, not an audit certification.</p>
  </div>
</section>

{/* ================= TRUSTED ================= */}
<div className="trust-outer"><div className="wrap" style={{ padding: "0" }}><div className="trust rv">
  <h2>Built for the people in the middle</h2>
  <p>The chase is nobody's job. Bailiff gives the person who is owed, the team chasing it and the counterparty's support desk one case to look at, with the same evidence in front of all of them.</p>
  <div className="logos">
    <div>Customers owed</div>
    <div>Small ops teams</div>
    <div>Vendor support desks</div>
    <div>Support desks</div>
  </div>
</div></div></div>

{/* ================= ARTICLE ================= */}
<section className="light" id="article" style={{ borderRadius: "0", marginTop: "0", paddingTop: "20px" }}>
  <div className="wrap"><div className="carousel rv">
    <button className="chev l" aria-label="Previous">&#8249;</button>
    <button className="chev r" aria-label="Next">&#8250;</button>
    <div className="article">
      <h3>&ldquo;Sent&rdquo; is the most expensive word in a complaint thread</h3>
      <p className="sub">A portal can accept an upload without opening a case. A fax can succeed into a queue nobody reads. Here is why a send receipt is not evidence, and what has to be read back before a case can honestly be called closed.</p>
      <a className="pill pill-outline" href="#integrations">Read the breakdown &#8594;</a>
    </div>
  </div></div>
</section>

{/* ================= INTEGRATIONS ================= */}
<section className="light" id="integrations" style={{ borderRadius: "0", marginTop: "0" }}>
  <div className="wrap">
    <div className="eyebrow rv">one case, every system</div>
    <h2 className="rv" style={{ maxWidth: "20ch" }}>Your systems, one case.<br/>It&rsquo;s a perfect match.</h2>
    <div className="cards3">
      <div className="card3 rv"><div className="fig"><svg viewBox="0 0 120 120"><path d="M20 20h30v12a8 8 0 0 0 16 0V20h34v34h-12a8 8 0 0 0 0 16h12v30H66v-12a8 8 0 0 0-16 0v12H20z"/></svg></div><h4>Case intake, any format</h4></div>
      <div className="card3 rv"><div className="fig"><svg viewBox="0 0 120 120"><path d="M92 46A36 36 0 1 0 96 68"/><path d="M96 26v22H74"/><circle cx="60" cy="60" r="12"/></svg></div><h4>Live requirement sync</h4></div>
      <div className="card3 rv"><div className="fig"><svg viewBox="0 0 120 120"><rect x="16" y="26" width="88" height="56" rx="8"/><path d="M30 68l16-18 14 10 22-26"/><path d="M44 96h32"/></svg></div><h4>Evidence and audit trail</h4></div>
    </div>
    <p className="sub rv">Cases arrive as PDFs, pasted text, portal exports and email threads. Bailiff normalises all of them into one case, keeps the payer and specialist requirements current, and keeps the evidence attached to the case that used it.</p>
    <a className="pill pill-outline rv" href="#demo">See a case end to end</a>
  </div>
</section>

{/* ================= FINAL CTA ================= */}
<section className="light" id="demo" style={{ borderRadius: "0", marginTop: "0" }}>
  <div className="wrap">
    <div className="eyebrow rv">outcome verification</div>
    <h2 className="rv">See what your cases are actually doing</h2>
    <a className="pill pill-outline rv" href="board/index.html">Request Demo</a>
  </div>
</section>

{/* ================= FOOTER ================= */}
<footer className="footer"><div className="wrap">
  <div className="f-top">
    <div>
      <svg className="f-mark" viewBox="0 0 170 48"><path d="M4 22H18L24 15L30 28L37 4L43 35L48 20L54 26H72" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"/><text x="3" y="45" fill="#fff" fontSize="29" fontWeight="800" letterSpacing="-1.1" fontFamily="Manrope">bailiff</text></svg>
      <small>&copy; 2026 Bailiff</small>
    </div>
    <div className="f-links">
      <a href="#top"><span className="ar">&#8594;</span>Our Solutions</a>
      <a href="#glove"><span className="ar">&#8594;</span>About Us</a>
      <a href="#article"><span className="ar">&#8594;</span>Blog</a>
      <a href="#integrations"><span className="ar">&#8594;</span>Docs</a>
      <a href="#demo"><span className="ar">&#8594;</span>Contact Us</a>
      <a className="pill pill-white" href="board/index.html">Request Demo</a>
    </div>
  </div>
  <div className="f-rule"></div>
  <div className="f-bot">
    <span>Verified resolution for anyone owed something.</span>
    <a href="#demo">Watch the demo</a>
    <span><a href="#">Privacy Policy</a> &middot; <a href="#">Terms and Conditions</a> &middot; <a href="#">LinkedIn</a></span>
  </div>
</div></footer>

</main>


      <ScriptTag />
    </>
  );
}

/* The imported page script, preserved verbatim: it drives the scroll scene and the
   word cycle by querying the DOM, so it runs once on the client exactly as written. */
const PAGE_SCRIPT = "(function(){\n  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;\n  function $(id){ return document.getElementById(id); }\n  var scene=$('scene'), heroCopy=$('heroCopy'), heroArt=$('heroArt'), dash=$('dashWrap'),\n      focus=$('focus'), nav=$('nav'), kw=$('kw'), sys=$('sys'), dia=$('dia'), trend=$('trend'),\n      pill=$('demoPill'), slot=$('pillSlot'), ctaBand=$('ctaBand'), process=$('process');\n\n  function clamp(v,a,b){ a=a===undefined?0:a; b=b===undefined?1:b; return Math.max(a,Math.min(b,v)); }\n  function ease(t){ return t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }\n  function lerp(a,b,t){ return a+(b-a)*t; }\n\n  /* ---- measure the real \"Request Demo\" text so the pill always fits it ---- */\n  function measure(fs,px,py){\n    var g=document.createElement('span');\n    g.style.cssText='position:absolute;visibility:hidden;white-space:nowrap;font-family:Manrope,sans-serif;font-weight:700;font-size:'+fs+'px';\n    g.textContent='Request Demo'; document.body.appendChild(g);\n    var w=g.offsetWidth+px*2, h=g.offsetHeight+py*2; g.parentNode.removeChild(g);\n    return {w:w,h:h};\n  }\n  var INLINE, DOCK, INLINE_FS;\n  function sizeSlot(){\n    var small = innerWidth<980;\n    INLINE_FS = small?15:22;\n    INLINE = measure(INLINE_FS, small?22:34, small?14:22);\n    DOCK   = measure(14, 24, 13);\n    slot.style.width=INLINE.w+'px';\n    slot.style.height=INLINE.h+'px';\n  }\n\n  /* ---- hero word cycle: timer-free cross-fade, box width follows the active word ---- */\n  var words=[].slice.call(kw.querySelectorAll('.kwW')), wordIdx=-1;\n  function sizeWords(){\n    words.forEach(function(w){ w.__w=w.getBoundingClientRect().width; });\n    if(wordIdx>=0 && words[wordIdx]) kw.style.width=words[wordIdx].__w+'px';\n  }\n  function setWord(i){\n    if(i===wordIdx) return; wordIdx=i;\n    words.forEach(function(w,n){ w.classList.toggle('on', n===i); });\n    if(words[i] && words[i].__w) kw.style.width=words[i].__w+'px';\n  }\n\n  function render(){\n    var max=scene.offsetHeight-innerHeight;\n    var p=clamp(scrollY/max);\n    var small=innerWidth<980;\n\n    setWord(p<.09?0:(p<.18?1:2));\n\n    var out=ease(clamp((p-.20)/.14));\n    heroCopy.style.opacity=String(1-out);\n    heroCopy.style.transform='translateY('+(-out*90)+'px) scale('+(1-out*.05)+')';\n    heroArt.style.opacity=String(.9*(1-out));\n    heroArt.style.transform='translateX('+(-out*70)+'px) scale('+(1-out*.1)+')';\n\n    /* dashboard: sliver bottom-right -> centre -> full-bleed -> exits up */\n    var rise=ease(clamp((p-.14)/.26));\n    var zoom=ease(clamp((p-.40)/.22));\n    var exit=ease(clamp((p-.66)/.14));\n    dash.style.left = lerp(40, small?4:2, rise)+'%';\n    dash.style.right= lerp(4,  small?4:2, rise)+'%';\n    dash.style.top  = lerp(88, 13, rise)+'%';\n    dash.style.opacity=String(1-exit);\n    dash.style.transform='translateY('+(-exit*innerHeight*.9)+'px) scale('+(lerp(.82,1,rise)+zoom*.16)+')';\n\n    var t=ease(clamp((p-.38)/.22));\n    sys.textContent=String(Math.round(lerp(1,3,t)));\n    dia.textContent='4';\n    trend.style.strokeDashoffset=String(760*(1-ease(clamp((p-.42)/.18))));\n\n    var fIn=ease(clamp((p-.80)/.10)), fOut=ease(clamp((p-.96)/.04));\n    focus.style.opacity=String(fIn*(1-fOut));\n    focus.style.transform='translateY('+((1-fIn)*44)+'px)';\n\n    nav.classList.toggle('gone', p>.20);\n\n    /* ---- travelling Request Demo pill: inline -> dips down -> parks top-right ---- */\n    var r=slot.getBoundingClientRect();\n    var slotDocTop=r.top+scrollY, slotDocLeft=r.left;\n    var start=ctaBand.offsetTop+ctaBand.offsetHeight*0.30;\n    var end  =process.offsetTop+innerHeight*0.25;\n    var k=ease(clamp((scrollY-start)/(end-start)));\n    /* freeze the source once the handoff begins, otherwise the pill would chase the\n       sentence off the top of the screen instead of visibly travelling to the corner */\n    var srcTop=slotDocTop-Math.min(scrollY,start);\n    var dx=innerWidth-DOCK.w-(small?18:34), dy=small?16:26;\n    var dip=Math.sin(Math.PI*k)*innerHeight*0.07;\n    pill.style.width =lerp(r.width||INLINE.w, DOCK.w, k)+'px';\n    pill.style.height=lerp(r.height||INLINE.h, DOCK.h, k)+'px';\n    pill.style.left  =lerp(slotDocLeft, dx, k)+'px';\n    pill.style.top   =(lerp(srcTop, dy, k)+dip)+'px';\n    pill.style.fontSize=lerp(INLINE_FS, 14, k)+'px';\n    pill.classList.toggle('docked', k>.5);\n    pill.classList.toggle('live', scrollY > ctaBand.offsetTop-innerHeight);\n  }\n\n  /* render synchronously on scroll: requestAnimationFrame is throttled or absent in\n     background/headless tabs, and a queued renderer would stall there permanently. */\n  var lastY=-1;\n  function tick(){ if(scrollY!==lastY){ lastY=scrollY; render(); } }\n  addEventListener('scroll',tick,{passive:true});\n  addEventListener('resize',function(){ sizeSlot(); sizeWords(); render(); });\n\n  var io=new IntersectionObserver(function(es){\n    es.forEach(function(e){ e.target.classList.toggle('on', e.isIntersecting); });\n  },{threshold:.22, rootMargin:'-8% 0px -14% 0px'});\n  Array.prototype.forEach.call(document.querySelectorAll('[data-step]'),function(el){ io.observe(el); });\n\n  var io2=new IntersectionObserver(function(es){\n    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('on'); io2.unobserve(e.target); } });\n  },{threshold:.16});\n  Array.prototype.forEach.call(document.querySelectorAll('.rv'),function(el,i){\n    el.style.transitionDelay=((i%3)*110)+'ms'; io2.observe(el);\n  });\n\n  sizeSlot(); sizeWords();\n  if(reduced){ pill.classList.add('live'); }\n  if(document.fonts && document.fonts.ready){ document.fonts.ready.then(function(){ sizeSlot(); sizeWords(); render(); }); }\n  render();\n})();";

// eslint-disable-next-line react/no-danger
const ScriptTag = () => (
  <Script id="page-scene" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: PAGE_SCRIPT }} />
);
void ScriptTag;
