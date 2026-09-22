<div align="center">

<img src="docs/screenshots/landing.jpg" alt="A case closes when the outcome is verified" width="100%" />

<br />

# bailiff

**A case against a company stays open until their own record shows the outcome. And the charge? That only moves when a grade passes.**

[![deployment](https://img.shields.io/website?url=https%3A%2F%2Faware-jellyfish-285.convex.site&label=deployment&up_message=live&down_message=down)](https://aware-jellyfish-285.convex.site)
![tests](https://img.shields.io/badge/tests-132%20passing-3fb950)
![integrations](https://img.shields.io/badge/integrations-9%20of%2010%20on-3fb950)
![licence](https://img.shields.io/badge/licence-MIT-blue)

**[the live site](https://aware-jellyfish-285.convex.site)** · **[the board](https://aware-jellyfish-285.convex.site/dashboard)** · **[is it up](https://aware-jellyfish-285.convex.site/health)** · **[every case as JSON](https://aware-jellyfish-285.convex.site/cases)**

</div>

---

## so what is this

You know the feeling. Something goes wrong with a company, you ring them, someone says "that's been refunded, it'll be with you in three days", and then nothing happens. Nobody can tell you whether that was a promise or a lie, because nothing was ever written down in a way you could check.

bailiff is the version where that can't happen.

A case opens with a short list of things that have to be true for it to be over. That list gets hashed **before** anyone picks up the phone. Then the case sits there, reading what comes back — a transcript, a page it fetched, a reply that landed in the mailbox. When the other side's own record shows up, the case closes. If it never shows up, the case says so out loud and eventually gives up on itself.

Nothing closes because someone said so. Not even us.

## the three rules, and yes they're in the code

1. **Evidence only counts if it was read after the case opened.** Otherwise you're closing a case with a world that's already moved on.
2. **Every requirement needs evidence of the same kind.** A promise gets checked against our own recording of the call. A statement about what *they* did needs *their* record — a recording of us talking can't prove it, however confident the person on the phone sounded.
3. **Closure isn't forever.** A daily job re-reads verified cases. If the thing that closed one has aged out, the closure is pulled back and the case goes back to disputed.

## the bit everyone forgets: money

A phone line opens cases. When a call ends, its claims get graded against three checks that are printed on the case:

```
promises_on_record   a promise, checked against our own recording of the call
unverified           a statement about their behaviour, needing their record
resolved             whether the caller's problem was actually dealt with
```

Only a passing grade writes a billing row, and it can't be written without that grade in the same transaction. The idempotency key is the call's own reference, so a replay re-reads one row instead of charging twice. If the meter can't be reached, the row sits **pending** — never quietly free.

And a case that nothing is happening on doesn't just sit there. It chases itself: first chase scheduled the moment the requirements freeze, every two days after that, at most three times. Then it's abandoned, with the reason and what was never read back written down.

## what you can actually do on the site

Not a mockup — every one of these is wired to the live deployment, and I've run all of them:

| | |
|---|---|
| open a case | freeze the requirement set, hashed before any call |
| start the call | the line dials, the case reference rides along in the call metadata |
| read a page | fetched on the server, timed, filed as *their* record |
| upload a document | a statement or a photo — hashed as it arrived, filed as ours |
| run the pipeline | grades a call, files its claims, releases the charge only on a pass |
| try to close it | refused in the backend's own words, naming what's missing |
| reopen it | a settled case goes back to disputed, and the record says why |

<img src="docs/screenshots/board.jpg" alt="the case board" width="100%" />

<img src="docs/screenshots/case.jpg" alt="one case: requirements, evidence, grade, charge" width="100%" />

<img src="docs/screenshots/integrations.jpg" alt="integrations, and the commands that check them" width="100%" />

## demo

<div align="center">

<a href="https://youtu.be/nlCXhzFYia4"><img src="demo/preview.gif" alt="The case that refused to close, then closed on the other side's own reply" width="100%" /></a>

<sub>**Two cuts, both under three minutes.** Take the <a href="demo/bailiff-clickthrough.mp4"><b>click-through</b></a> — 61 seconds, twelve real steps, a caption on each: the board, a case that closed, a case refused, a document hashed as it arrived, the deployment checking itself. <a href="https://youtu.be/nlCXhzFYia4">Watch the explainer on YouTube</a> for the reasoning behind it.</sub>

<sub>Every frame of both comes from the live deployment. In the explainer the open and the close are rendered pieces; in the click-through even those are the product's own screens.</sub>

</div>

What it shows, in order: the rule it enforces, the three requirements a case is frozen on, the board with every case the pipeline has touched, a case opened and its requirement set hashed, one case end to end — requirement, evidence with read times and hashes, the grade with its checks printed, the charge that grade released — a close attempt refused in the backend's own words, a document uploaded and hashed as it arrived, the deployment checking itself in one request, and the honest line at the end.

The live site is also the demo: [open the board](https://aware-jellyfish-285.convex.site/dashboard), click a case, read what closed it.

## what it's built on

Every vendor call happens inside a Convex function — never in the browser, never in a route handler — so it lands in the same transaction log as the thing it's justifying. A missing key doesn't get faked: the integration reports itself off and the pipeline stops right there with the variable named on the case.

| | what it does | does it work |
|---|---|---|
| Convex | the case, the evidence, the audit trail, every state move | yes |
| Vapi | the phone line, two tools, and its own reading of each call | yes |
| Firecrawl | reading a page as evidence, with the time it was read | fetched a real page |
| AgentMail | the mailbox a case writes to and reads from | real mail, real message id |
| OpenAI | reading a call into claims when the platform didn't | keyed, but the provider wants credit |
| Scorecard | an outside evaluator gets the same graded run | delivered, acknowledged |
| Autumn | metering a released charge | event accepted |
| Inkeep | grounding during a call | off — the account has no org |

## go on then, check it

Four reads, no auth, nothing that can change anything:

```bash
curl -s https://aware-jellyfish-285.convex.site/selftest   # the deployment, checking itself
curl -s https://aware-jellyfish-285.convex.site/health     # which integrations carry a key
curl -s https://aware-jellyfish-285.convex.site/cases      # the same rows the board renders
curl -s "https://aware-jellyfish-285.convex.site/case?ref=case-2026-0914-0188"
```

The last one comes back with a `proof` block — the whole claim in four lines: the requirement set's hash, the requirement it was satisfied by with the source and the hash of that evidence, the grade and its checks, and the state of the charge:

```json
"proof": {
  "state": "VERIFIED",
  "requirementSetHash": "39d5db9408b76c39…",
  "requirements": [{ "key": "refund_moved", "satisfied": true,
    "satisfiedBy": { "source": "mail:billing@meridian.example",
                     "sourceKind": "counterparty", "hash": "54336d5b8d2c4d9e…" } }],
  "grades": [{ "verdict": "pass", "checks": […3 checks…] }],
  "billing": [{ "state": "metered", "key": "call:call-0914-0188-1" }]
}
```

And the first one is the honest one: it asks the deployment what it can actually do, writes four bytes to storage to prove storage works, reads them back, deletes them, and reports the checks it could not run as **skipped rather than passing**. `knowledge: false` in the health check is the point — what's broken gets said out loud.

## running it yourself

```bash
git clone https://github.com/subheeksh5599/bailiff && cd bailiff
npm install && npm test          # 132 tests, no vendor keys needed
npx convex dev                   # the backend
cd frontend && npm install && npm run dev
```

`frontend/.env.local` wants one line — `NEXT_PUBLIC_CONVEX_URL` — or the build refuses to run and tells you why. A panel built without it would export fine and then open with nothing behind it, which is worse than a build that stops. There is no sample data anywhere in this repo.

## the honest bit

| | |
|---|---|
| the case machine, the verifier, requirement freezing | real, tested |
| claim verdicts, evidence freshness, who's allowed to prove what | real, tested |
| the billing gate, idempotency, retries | real, tested |
| webhooks | real, and they refuse everything when their secret isn't set |
| the chase cadence | real, tested, and run against the live deployment |
| file uploads | real: uploaded, hashed from the bytes, readable again |
| the integrations | 9 of 10 keyed and exercised live — the exceptions are below |
| OpenAI extraction | keyed, provider answers 402. Doesn't matter: claims come from the call platform's own reading of the call |
| Inkeep | off. No org on that account |
| dialling out from the board | built, and refused by the plan (platform numbers have a daily outbound limit). Inbound works, that's what the demo uses |
| the assistant never stating an unread number | mechanism is in place, not yet exercised on a real call |
| demo video | recorded: [https://youtu.be/nlCXhzFYia4](https://youtu.be/nlCXhzFYia4) (100s), committed as `demo/bailiff-demo.mp4`, shot-by-shot script in `demo/SCRIPT.md` |
| live site | everything above answers: landing, board, health, `/cases`, `/case` |

## layout

```
convex/            the case, the pipeline, the adapters, the routes
frontend/          the site — landing page and the board
tests/             132 tests
demo/              the video, the stills it was cut from, and the script that assembles it
docs/              integrations, deployments, the demo beat sheet, run output
hackathon.md       the build log, including what a live deployment found
```

MIT.
