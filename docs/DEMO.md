# The demo

**Delivered:** [https://youtu.be/AYrAlrk17Yk](https://youtu.be/AYrAlrk17Yk) — 96 seconds.
A local copy of the same cut is committed at [`demo/bailiff-recorded.mp4`](../demo/bailiff-recorded.mp4)
(1920×1080, H.264, 4.4 MB). The thumbnail in the README is a frame from this recording,
`docs/media/bailiff-demo-poster.png` — not a separate screenshot.

## What it shows

One session on the live deployment, in order: the landing page and what it claims, the board and
its counts, a case that closed on the other side's own reply with every requirement pointing at the
evidence that satisfied it, a case that cannot close and names the requirement with nothing behind
it, a page read on the server and filed against the case, a document hashed as it arrived, and the
deployment's own self-test over HTTP.

Reads are public; the actions are not. The recording runs signed in, which is the state a real
operator works in, and every number on screen is read back from the deployment rather than typed
in.

## How it was made

Two scripts, both committed.

`scripts/record_demo.py` performs the session in a real browser. The frames are Chrome's own
screencast and every click is a dispatched mouse event at the element's real coordinates — the
pointer drawn on screen marks where the press actually landed, so it is a marker at the real event
position rather than a composited cursor. Frames arrive when the page repaints, not on a clock, and
each one is written to disk with the wall-clock time it arrived.

The session needs a signed-in board, and a recording should not require the operator to type her
passphrase into a script. Authority on this deployment is already the deploy key, so a session is
minted from the command line (`auth:mintSession`, an internal mutation) and handed to the browser.
The recorder never sees the passphrase.

`scripts/assemble_recording.py` cuts it. Because frames arrive on repaint, each is held for the
interval it was genuinely on screen: a burst means something moved, a gap means nothing did. That
reproduces the session rather than inventing a frame rate for it, which is why motion reads like a
screen share instead of invented smoothness.

Narration is generated per step and placed at the moment that step began, taken from the recorder's
own timeline. Lines **queue**: a line is placed at its beat but never before the previous one has
stopped speaking, and the assembler refuses to build a cut where two lines overlap rather than
trusting the arithmetic. A step that produced no repaint at all — the page did not change, so no
frame arrived — is anchored to the last step that did produce one, or its line would land inside
the line before it.

## Rebuilding it

```bash
# 1. perform the session (needs the browser harness, and a signed-in deployment)
python3 scripts/record_demo.py             # writes demo/recording/frames + timeline.json

# 2. cut it and lay the narration on the beats
python3 scripts/assemble_recording.py      # writes demo/bailiff-recorded.mp4
```

The recorder sizes the browser window from the difference between the window and the viewport
before it starts: the screencast follows the window, not the device-metrics override, so the window
has to be the size of the frame we want. Frames land at exactly 1920×1080 because of that
measurement, not by luck. Earlier, frames came out at 1280×577 — an odd height that H.264 refuses
outright — which is the defect that measurement exists to prevent.

## The click sheet

[`demo/CLICKS.md`](../demo/CLICKS.md) is the same session written as clicks and lines only, for
recording by hand. It names the two controls not to press on camera — one grades a call that has
already been ingested, the other is refused by the phone platform's own outbound limit — so neither
turns into a dead click in a take.

## What is not here

Earlier cuts — an explainer over stills, a captioned click-through, and a rendered motion piece —
were removed once this recording replaced them, along with their images, narration tracks and build
scripts. Their footage was mostly stills of a static page, which is the one thing a demo of this
product should not be.
