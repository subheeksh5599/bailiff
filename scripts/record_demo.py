"""Record the product being driven, with a pointer and real clicks.

Run inside the browser harness (the helpers are already in scope):

    exec(open("/home/arch/bailiff/scripts/record_demo.py").read())

What it does, and what it does not do:

- every click is a real CDP input event at the element's own coordinates, so the page
  responds the way it responds to a person;
- Chrome's screencast supplies the frames, so this is motion captured from the renderer
  rather than a slideshow of re-taken screenshots;
- the pointer is a marker drawn at those same coordinates, because a headless browser has
  no operating-system cursor to film. It is an annotation of where the real event landed,
  not a decoration pretending to be one.

Frames are written as they arrive, each with the wall-clock time it was captured, so the
edit can hold every frame for as long as it was actually on screen and the narration can
land on the step it belongs to.
"""

import base64
import json
import pathlib
import time

SITE = "https://aware-jellyfish-285.convex.site"
OUT = pathlib.Path("/home/arch/bailiff/demo/recording")
TIMELINE = pathlib.Path("/home/arch/bailiff/demo/recording/timeline.json")
SESSION = pathlib.Path("/tmp/recording-session").read_text().strip()

CURSOR = r"""
(() => {
  if (document.getElementById('__rec_cursor')) return 'already there';
  const dot = document.createElement('div');
  dot.id = '__rec_cursor';
  dot.style.cssText = [
    'position:fixed', 'left:-100px', 'top:-100px', 'width:20px', 'height:20px',
    'margin:-10px 0 0 -10px', 'border-radius:999px', 'background:#ffffff',
    'box-shadow:0 0 0 2.5px rgba(8,9,11,.9), 0 0 0 4.5px rgba(255,255,255,.35), 0 8px 22px rgba(0,0,0,.55)',
    'z-index:2147483647', 'pointer-events:none',
    'transition:left .30s cubic-bezier(.22,.61,.36,1), top .30s cubic-bezier(.22,.61,.36,1)'
  ].join(';');
  document.body.appendChild(dot);
  const ring = document.createElement('div');
  ring.id = '__rec_ring';
  ring.style.cssText = [
    'position:fixed', 'left:-100px', 'top:-100px', 'width:46px', 'height:46px',
    'margin:-23px 0 0 -23px', 'border-radius:999px', 'border:2px solid rgba(255,255,255,.85)',
    'opacity:0', 'z-index:2147483646', 'pointer-events:none',
    'transition:opacity .35s ease-out, transform .35s ease-out'
  ].join(';');
  document.body.appendChild(ring);
  window.__recMove = (x, y) => {
    dot.style.left = x + 'px'; dot.style.top = y + 'px';
  };
  window.__recPulse = (x, y) => {
    ring.style.transition = 'none';
    ring.style.left = x + 'px'; ring.style.top = y + 'px';
    ring.style.transform = 'scale(.5)'; ring.style.opacity = '.95';
    void ring.offsetWidth;
    ring.style.transition = 'opacity .45s ease-out, transform .45s ease-out';
    ring.style.transform = 'scale(1.5)'; ring.style.opacity = '0';
  };
  return 'installed';
})()
"""

frames: list[dict] = []
started_at = 0.0


def drain(label: str = "") -> int:
    """Collect whatever Chrome has rendered since the last look."""
    events = drain_events() or []
    got = 0
    for event in events:
        if (event.get("method") or "") != "Page.screencastFrame":
            continue
        index = len(frames)
        path = OUT / f"f{index:05d}.jpg"
        path.write_bytes(base64.b64decode(event["params"]["data"]))
        frames.append({"file": path.name, "at": time.time(), "step": label})
        cdp("Page.screencastFrameAck", sessionId=event["params"]["sessionId"])
        got += 1
    return got


def hold(seconds: float, label: str = "") -> None:
    """Sit still, but keep collecting: a repaint during a hold is a real frame."""
    end = time.time() + seconds
    while time.time() < end:
        drain(label)
        time.sleep(0.08)


LAST_POS = [960.0, 540.0]


def ensure_cursor() -> None:
    """The marker lives in the document, so a navigation removes it. Put it back.

    It is also re-placed at the last known position, otherwise a page that loaded after
    the last click would show the pointer parked in the corner.
    """
    js("(() => { if (!document.getElementById('__rec_cursor')) { " + CURSOR.strip() + " } })()")
    js(f"(() => {{ const d = document.getElementById('__rec_cursor'); if (d) {{ d.style.left = '{LAST_POS[0]:.0f}px'; d.style.top = '{LAST_POS[1]:.0f}px'; }} }})()")


def rect(selector_js: str) -> dict | None:
    value = js(f"""(() => {{
      const el = {selector_js};
      if (!el) return null;
      el.scrollIntoView({{ block: 'center', behavior: 'instant' }});
      const r = el.getBoundingClientRect();
      return {{ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
               w: Math.round(r.width), h: Math.round(r.height) }};
    }})()""")
    return value


def move_to(x: float, y: float, steps: int = 6, label: str = "") -> None:
    """Move the way a hand does: several intermediate positions, each a repaint."""
    ensure_cursor()
    here = js("(() => { const d = document.getElementById('__rec_cursor'); return d ? [parseFloat(d.style.left)||0, parseFloat(d.style.top)||0] : [0,0]; })()")
    x0, y0 = (here or [0, 0])[:2]
    LAST_POS[0], LAST_POS[1] = float(x), float(y)
    for i in range(1, steps + 1):
        t = i / steps
        nx = x0 + (x - x0) * t
        ny = y0 + (y - y0) * t
        js(f"window.__recMove({nx:.0f}, {ny:.0f})")
        cdp("Input.dispatchMouseEvent", type="mouseMoved", x=round(nx), y=round(ny))
        time.sleep(0.10)
        drain(label)
    time.sleep(0.25)
    drain(label)


def click(x: float, y: float, label: str = "") -> None:
    move_to(x, y, label=label)
    js(f"window.__recPulse({x:.0f}, {y:.0f})")
    cdp("Input.dispatchMouseEvent", type="mousePressed", x=round(x), y=round(y), button="left", clickCount=1)
    time.sleep(0.06)
    cdp("Input.dispatchMouseEvent", type="mouseReleased", x=round(x), y=round(y), button="left", clickCount=1)
    time.sleep(0.5)
    drain(label)


def click_by_text(text_js: str, label: str, selector: str = "a,button") -> bool:
    r = rect(f"[...document.querySelectorAll('{selector}')].find(e => {text_js})")
    if not r:
        print(f"    !! nothing matched: {label}")
        return False
    click(r["x"], r["y"], label)
    return True


def scroll_by(px: int, label: str) -> None:
    js(f"window.scrollBy({{ top: {px}, behavior: 'smooth' }})")
    hold(0.9, label)


def main() -> None:
    global started_at
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.jpg"):
        old.unlink()

    # The screencast follows the window, not the device-metrics override, so the window
    # is what has to be the size of the frame we want.
    try:
        window = cdp("Browser.getWindowForTarget")
        window_id = window["windowId"]
        cdp("Browser.setWindowBounds", windowId=window_id,
            bounds={"left": 0, "top": 0, "width": 1920, "height": 1080, "windowState": "normal"})
        time.sleep(1.2)
        # The frame is the viewport, and the window is the viewport plus whatever chrome
        # the browser draws. Measure that difference instead of guessing at it, so the
        # capture comes out at exactly 1920x1080 with nothing letterboxed.
        viewport_w, viewport_h = (js("[window.innerWidth, window.innerHeight]") or [1920, 1080])[:2]
        chrome = 1080 - viewport_h
        if chrome > 0:
            cdp("Browser.setWindowBounds", windowId=window_id,
                bounds={"left": 0, "top": 0, "width": 1920, "height": 1080 + chrome, "windowState": "normal"})
            time.sleep(1.2)
            print(f"window sized to 1920x{1080 + chrome} for a {js('[window.innerWidth, window.innerHeight]')} viewport")
    except Exception as exc:
        print("could not size the window:", exc)
    cdp("Emulation.setDeviceMetricsOverride", width=1920, height=1080, deviceScaleFactor=1, mobile=False)
    time.sleep(1.5)
    print("viewport:", js("[window.innerWidth, window.innerHeight]"))

    # the session first, so the app boots signed in rather than showing the way in
    goto_url(f"{SITE}/dashboard")
    wait_for_load()
    js(f"window.localStorage.setItem('bailiff.operator.session', {json.dumps(SESSION)})")
    goto_url(f"{SITE}/")
    wait_for_load()
    time.sleep(4)
    print("cursor:", js(CURSOR))
    print("start screencast:", cdp("Page.startScreencast", format="jpeg", quality=88, everyNthFrame=1,
                                   maxWidth=1920, maxHeight=1080))
    started_at = time.time()
    print("recording from", time.strftime("%H:%M:%S"))

    # 1. the landing page, as a person meets it
    hold(2.5, "landing")
    js("window.__recMove(960, 700)")
    hold(0.6, "landing")

    scroll_by(520, "landing-hero")
    hold(1.6, "landing-hero")
    scroll_by(700, "landing-what-is-verified")
    hold(1.8, "landing-what-is-verified")

    # 2. the board, already the operator's
    click_by_text("/Open the board/i.test(e.innerText)", "open-the-board")
    hold(3.5, "board")
    ensure_cursor()

    scroll_by(500, "board-list")
    hold(1.6, "board-list")
    scroll_by(900, "board-numbers")
    hold(2.0, "board-numbers")
    scroll_by(-2000, "board-top")
    hold(1.0, "board-top")

    print("frames so far:", len(frames), "| elapsed:", round(time.time() - started_at, 1), "s")

    # 3. a case that closed
    ensure_cursor()
    r = rect("[...document.querySelectorAll('a')].find(e => /case-2026-0914-0188/.test(e.getAttribute('href')||''))")
    if r:
        click(r["x"], r["y"], "open-closed-case")
    hold(3.0, "case-closed")
    scroll_by(700, "case-requirements")
    hold(2.2, "case-requirements")
    scroll_by(600, "case-evidence")
    hold(2.4, "case-evidence")
    scroll_by(700, "case-grade")
    hold(2.4, "case-grade")

    # 4. a case that cannot close, and the refusal
    rect("[...document.querySelectorAll('a')].find(e => /Case board/.test(e.innerText))")
    r = rect("[...document.querySelectorAll('a')].find(e => /Case board/.test(e.innerText))")
    if r:
        click(r["x"], r["y"], "back-to-board")
    hold(2.5, "back-to-board")
    r = rect("[...document.querySelectorAll('a')].find(e => /case-ui-kzx3/.test(e.getAttribute('href')||''))")
    if r:
        click(r["x"], r["y"], "open-open-case")
    hold(3.0, "case-open")
    scroll_by(900, "case-operator")
    hold(1.8, "case-operator")
    click_by_text("/try to close it/i.test(e.innerText)", "try-to-close")
    hold(3.2, "refusal")

    print("frames so far:", len(frames), "| elapsed:", round(time.time() - started_at, 1), "s")

    # 5. reading a page as evidence, and taking a file
    r = rect("[...document.querySelectorAll('button')].find(e => /^read it$/i.test(e.innerText.trim()))")
    if r:
        click(r["x"], r["y"], "read-it")
    hold(4.5, "read-it-result")
    scroll_by(700, "upload-block")
    hold(1.6, "upload-block")

    # taking a file: the hash appears from the bytes that arrived
    handle = js("""(() => {
      const input = document.querySelector('input[type=file]');
      if (!input) return 'no file input';
      input.scrollIntoView({ block: 'center' });
      const r = input.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) });
    })()""")
    if handle and handle != "no file input":
        point = json.loads(handle)
        move_to(point["x"], point["y"], label="upload-block")
        root = cdp("DOM.getDocument")["root"]["nodeId"]
        node = cdp("DOM.querySelector", nodeId=root, selector="input[type=file]")["nodeId"]
        cdp("DOM.setFileInputFiles", files=["/tmp/demo-statement.txt"], nodeId=node)
        hold(1.2, "file-chosen")
        r = rect("[...document.querySelectorAll('button')].find(e => /^file it$/i.test(e.innerText.trim()))")
        if r:
            click(r["x"], r["y"], "file-it")
        hold(4.0, "hashed")

    # 6. the deployment reporting itself
    click_by_text("/^integrations$/i.test(e.innerText.trim())", "integrations")
    hold(3.0, "integrations")
    scroll_by(800, "integrations-body")
    hold(2.2, "integrations-body")

    goto_url(f"{SITE}/selftest")
    wait_for_load()
    hold(1.0, "selftest")
    move_to(960, 430, label="read-the-json")
    ensure_cursor()
    hold(2.5, "selftest")

    print("stop screencast:", cdp("Page.stopScreencast"))
    total = time.time() - started_at
    timeline = {
        "site": SITE,
        "started_at": started_at,
        "seconds": round(total, 1),
        "frames": frames,
    }
    TIMELINE.write_text(json.dumps(timeline))
    print(f"frames: {len(frames)} over {total:.1f}s (~{len(frames)/max(total,1):.1f} fps)")
    print("timeline:", TIMELINE)


main()
