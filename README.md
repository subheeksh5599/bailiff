<div align="center">

# BAILIFF

### A case against a company that owes you stays open until their own record proves the outcome.

[![Tests](https://img.shields.io/badge/tests-200%20passing-10b981)](#tests)
[![Live](https://img.shields.io/badge/live-aware--jellyfish--285.convex.site-2ecc71)](https://aware-jellyfish-285.convex.site)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Stack](https://img.shields.io/badge/Convex%20%2B%20Next.js%20%2B%20TypeScript-1f1f23)

[![▶ Watch the demo](https://img.shields.io/badge/%E2%96%B6%20Watch%20the%20demo-1%3A36-FF0000?labelColor=1f1f23)](https://youtu.be/AYrAlrk17Yk) [![Local copy](https://img.shields.io/badge/Local%20copy-demo%2Fbailiff--recorded.mp4-14151a?labelColor=0f1420)](demo/bailiff-recorded.mp4) [![Honesty table](https://img.shields.io/badge/Honesty%20table-what%20is%20real%20vs%20pending-14151a?labelColor=0f1420)](#whats-real-vs-pending--the-honesty-table) [![Run it](https://img.shields.io/badge/Run%20it-one%20command-14151a?labelColor=0f1420)](#-see-it-in-one-command)

</div>

Chasing money someone owes you is a correspondence problem with no memory. You send the message, someone half-answers, the thread dies, and three weeks later nobody can say what was even promised. BAILIFF answers the harder question instead of the easy one: **not "did we ask them again?" but "does the other side's own material show the outcome?"** A case opens with the facts that must be true for it to be over, frozen and hashed before anyone is contacted. Every read is fetched on the server and stored with the time it happened and a hash of what came back. A promise is graded against our own recording of the call; a claim about what *they* did needs *their* record. When the requirement is satisfied the case closes pointing at the evidence that closed it — and the charge is released only by a grade that passed, which printed every check it made. Ask it to close early and it refuses, naming the requirement that has nothing behind it.

```
SAID  ≠  READ  ≠  PROVEN
```

There is no `CLOSED_WITH_WARNINGS`. Either the requirement was satisfied by material read back after the case opened and belonging to the side that owns the fact, or the case stays open and says which requirement has nothing behind it. The refusal is the product.

## Live status

**Every row below was run against the deployment**, not against a local copy. `/selftest` writes four bytes to storage, reads them back, removes them, and reports anything it could not check as **skipped rather than passing** — because a green tick for a check nobody ran is the exact failure this project exists to catch.

| Surface | Status | The evidence |
|---|---|---|
| The deployment | **LIVE** | `/health` reports **9 of 10** integrations carrying a key; the tenth says so itself |
| The board | **LIVE** | behind an operator session, and a live subscription rather than a snapshot: a case that moves in another tab, from a webhook or on the sweep lands here without a refresh |
| The self-test | **LIVE** | 5 checks: integrations, **storage written and read back**, mail path, 20 cases readable, the grade's rubric intact |
| A case closing | **LIVE** | a case that was refused closed only once the counterparty's own reply arrived, and it names that reply |
| Firecrawl | **LIVE** | a real page fetched, its text stored with the time and a hash of what came back |
| AgentMail | **LIVE** | the report sent, the reply received, and the reply filed as the evidence that closed the case |
| The call platform | **LIVE** | a number answers on this project's own assistant, carrying the server URL, the shared secret and both tools |
| Metering | **LIVE** | a metered event accepted, keyed on the call reference that justified it |
| OpenAI | **KEYED, 402, FALLS BACK** | the first reader answers `402 insufficient_quota`; the quota refills automatically on 24 September 2026, after this event closes. The chain in `convex/integrations/readers.ts` falls through to a second reader rather than stopping, and that reader read a live transcript on this deployment — the claims came back with `read_by: router`. `/health` reports the readers, in the order they are tried |
| Inkeep | **OFF** | that account belongs to no organization. `/health` reports it `false` rather than pretending |
| The public hooks | **BOUNDED** | two token buckets, one per case (30/min, burst 10) and one for the deployment (240/min, burst 60). A burst of 16 was refused live, naming the limit and the retry |
| The build, posted | **LIVE** | [https://x.com/KomariS18774/status/2102368912549753004](https://x.com/KomariS18774/status/2102368912549753004) — tagged to the four sponsors, as the event asks |

## ▶ Demo

[![▶ Watch the demo: 1:36, real screen capture of the live deployment](docs/media/bailiff-demo-poster.png)](https://youtu.be/AYrAlrk17Yk)

**[▶ Watch the demo (1:36)](https://youtu.be/AYrAlrk17Yk)** &nbsp;·&nbsp; **[ Local copy ↗ ](demo/bailiff-recorded.mp4)** &nbsp;·&nbsp; **[ What's real vs pending ↗ ](#whats-real-vs-pending--the-honesty-table)** &nbsp;·&nbsp; **[ Run it yourself ↗ ](#-see-it-in-one-command)**

_One session on the live deployment, one take, and no cut that hides a step. The frames are Chrome's own screencast and every click is a dispatched mouse event at the element's real coordinates, so the pointer marks where the press actually landed; each frame is held for the interval it was genuinely on screen, which is why motion looks like a screen share rather than invented smoothness. Nothing is mocked and the refusals shown are refusals the backend returned._

## The 20-second pitch

A refund that never arrived. You can prove what you sent. You cannot prove what they never said, and the arithmetic of "did the money actually move" lives entirely in their systems. So the thread goes quiet, and the case dies of politeness.

The second wound is quieter. Somebody on a call says "that's sorted" and everyone moves on. Nothing recorded can be held to, and three weeks later the promise is a memory with a date on it.

**BAILIFF is a case file with a gate on it.** The requirement set is frozen and hashed at intake. Reads carry their own receipts. Promises are graded against the transcript we recorded. Claims about the other side need the other side's material. Closure and money both sit behind the same gate, and a refusal names the requirement it refused on.

## Table of contents

- [Live status](#live-status)
- [▶ Demo](#-demo)
- [The 20-second pitch](#the-20-second-pitch)
- [▶ See it in one command](#-see-it-in-one-command)
- [Screenshots](#screenshots)
- [Verify every claim in one command](#verify-every-claim-in-one-command)
- [What BAILIFF is NOT](#what-bailiff-is-not)
- [The problem I set out to solve](#the-problem-i-set-out-to-solve)
- [How each sponsor is used](#how-each-sponsor-is-used)
- [What I built](#what-i-built)
- [Architecture](#architecture)
- [The close loop, step by step](#the-close-loop-step-by-step)
- [Where the guarantee is enforced](#where-the-guarantee-is-enforced)
- [What the grade measures](#what-the-grade-measures)
- [Where the model sits](#where-the-model-sits)
- [Who approves what](#who-approves-what)
- [Engineering decisions & the traps that taught me something](#engineering-decisions--the-traps-that-taught-me-something)
- [What's real vs pending — the honesty table](#whats-real-vs-pending--the-honesty-table)
- [Attack → test](#attack--test)
- [The app](#the-app)
- [Limitations](#limitations)
- [Security](#security)
- [Tech stack](#tech-stack)
- [Project layout](#project-layout)
- [Full command reference](#full-command-reference)
- [How I'd deploy it](#how-id-deploy-it)
- [Results and supporting records](#results-and-supporting-records)
- [Tests](#tests)
- [License](#license)

## ▶ See it in one command

No vendor keys and no network beyond the deployment — the rules are tested as rules:

```bash
$ npm install && npm test
 Test Files  13 passed (13)
      Tests  200 passed (200)
   Duration  16.30s
```

```bash
$ curl -s https://aware-jellyfish-285.convex.site/selftest | python3 -m json.tool
{
    "checks": [
        { "name": "integrations", "ok": true,
          "detail": "9 on (convex, firecrawl, extraction, grading, metering, email, mailReceives, telephony, hooks); off: knowledge" },
        { "name": "storage", "ok": true,
          "detail": "wrote 4 bytes, read them back, and removed them again" },
        { "name": "mailPath", "ok": true,
          "detail": "mail goes out through agentmail" },
        { "name": "casesReadable", "ok": true,
          "detail": "20 case(s) on the deployment" }
    ],
    "ran": 5, "failed": 0, "skipped": 0, "ok": true
}
```

## Screenshots

| The landing page | One case, end to end |
|---|---|
| [![Landing](docs/screenshots/landing.jpg)](docs/screenshots/landing.jpg) | [![A case](docs/screenshots/case.jpg)](docs/screenshots/case.jpg) |

| The board, every case it has touched | The deployment, reporting itself |
|---|---|
| [![Board](docs/screenshots/board.jpg)](docs/screenshots/board.jpg) | [![Integrations](docs/screenshots/integrations.jpg)](docs/screenshots/integrations.jpg) |

## Verify every claim in one command

Three reads, no auth, nothing that can change anything:

```bash
$ curl -s https://aware-jellyfish-285.convex.site/health \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['ok'], sum(1 for v in d['integrations'].values() if v), 'of', len(d['integrations']))"
True 9 of 10

$ curl -s https://aware-jellyfish-285.convex.site/cases \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin)), 'cases')"
20 cases

$ curl -s "https://aware-jellyfish-285.convex.site/case?ref=case-2026-0914-0188" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['proof']['state'], d['proof']['grade']['verdict'])"
VERIFIED pass
```

The `proof` block on a single case is the whole claim in a size you can diff: the requirement-set hash, each requirement with the source and the hash of the evidence that satisfied it, the grade with its checks, and the charge's state.

## What BAILIFF is NOT

- **Not a chatbot over your inbox.** Nothing here answers questions. It decides whether a case may close and whether money may be charged, and it refuses.
- **Not a payment rail.** No funds move through this. The charge is a ledger row a passing grade released; the product's job is to make that row impossible to write by accident.
- **Not a letter generator.** It does not draft prose for you to argue with. It sends one message per step, with the case reference in it, and files what comes back.
- **Not a replacement for a lawyer or a court.** It is the record you would want when you get there: what you asked for, when they were asked, what came back, and what is still missing.

## The problem I set out to solve

Unexplained-message disputes are one-sided by construction. You can prove what you sent. You cannot prove what they never said, and the arithmetic of "did the refund actually move" lives entirely in their systems. The asymmetry is the whole problem: the party with the information has no reason to hand it over, and the party without it has no way to force the question.

Software usually answers this with a nicer inbox. That is a filing cabinet. Filing cabinets do not close anything — they just make the silence tidier. The question I wanted answered was narrower and harder: **what would it take for this to be over, and can that condition be checked without trusting either side's account of it?**

### The same problem, in their words

I went looking for people describing this before writing anything, and the complaints are the same
shape over and over: a claim that the money moved, and nothing the person waiting can check.

**r/CashApp**, on $800 that the app insisted was refunded (19 May 2025):

> "I waited the 3-5 business days and still did not have the $800 posted to either my Chase checking
> account or my Cash App balance... My Cash App account says the refund was completed, but it wasn't.
> I've been out $800 for over a month now because of this."

> "Chase keeps telling me to deal with Cash App, Cash App keeps telling me to deal with Chase."

https://www.reddit.com/r/CashApp/comments/1kqeg3s/

A status screen is not a payment record. Under this product's rules the two are different kinds of
evidence: a status page is read as `page_fetch` and can corroborate a requirement, while a record of
the money is a different kind that a page cannot satisfy. Her case would not have closed on the app
saying "completed", which is exactly the sentence that was wrong.

**r/whatdoIdo**, $120 paid and cancelled on three times (20 March 2025, 14.8k upvotes):

> "I still have yet to get my refund let alone see proof of a refund after asking countless times."

https://www.reddit.com/r/whatdoIdo/comments/1jfugwv/

"Proof of a refund" is the product in five words. She had already walked every transaction in her
account by hand, which is what people do when no system will do it for them.

**r/uphold**, a deadline that passed in silence (6 August 2026):

> "I received an email stating my funds would be removed and refunded within 24 business hours. That
> timeline has passed, and the USD is still sitting completely stuck inside my restricted Uphold
> account... I have not received a response or an update since."

https://www.reddit.com/r/uphold/comments/1vh87iw/

A stated deadline, a missed deadline, and nobody keeping score. A case here keeps its own clock: it
schedules its first chase when the requirements freeze, sweeps hourly, chases three times at most,
and then abandons with a reason rather than trailing off.

**Trustpilot**, a returned mattress and £319 (Argos, review "A nightmare trying to get a refund"):

> "They acknowledged receiving the mattress and confirmed that a refund was being processed. Twelve
> days later, after numerous pointless live chats and customer service calls, I still haven't received
> the £319 refund. I was told their Finance Team would contact me within 48 hours. That never happened."

> "Argos are also refusing to provide the ARN for the refund they claim to have issued, even though
> they can't tell me exactly when it was issued."

https://www.trustpilot.com/review/www.argos.co.uk

That last sentence is the whole product. An ARN is the one identifier that would let either side find
the refund. Withheld, and with no date, the refund is claimed and unsupported at the same time, and
the person waiting has no way to tell whether it exists.

### That case, run through this deployment

Not a scenario in a slide: a case built to mirror the last complaint, live and readable right now at
[`/case?ref=case-arn-319`](https://aware-jellyfish-285.convex.site/case?ref=case-arn-319).

The requirement is the refund's own identifier, sent by the counterparty after the case opened, of
kind `email_reply`. That kind can only be carried by an inbound reply from the counterparty, so a
status page saying "issued" can never close it. The requirement set was frozen and hashed, and then
the close was attempted:

```
attempt to close: {"closed": false,
  "unsatisfied": [{"key": "refund_identifier",
    "reason": "no evidence of this kind has been read back"}]}
```

The case's own audit trail carries that refusal with the case id, the set hash
`98dd7a98f43474c2f35ea42419249d2a180dd12573f9b3e20e59d00cd099f3b9`, and the sentence above. This is
the same refusal the product returns when asked to call something done without a record behind it,
and it is the same refusal a charge would meet, since no charge moves without a grade that passes.

## What I built

- **A case ledger on Convex** — the case, its frozen requirements, its evidence, its claims, its grades, its charge, and its audit trail, all in one schema where the money-adjacent fields can only be written by the code that checks them.
- **Freeze and hash at intake.** The requirement set is hashed when the case opens. A test proves a changed set produces a different hash, so a moved goalpost is visible rather than arguable.
- **Server-side reads with receipts.** A page read, an inbound email, a call transcript, or the owner's uploaded file — each stored with its kind, its source, the time it was read, and a hash of what came back.
- **A grade that prints its checks.** Every claim is judged by where it stands: a promise against our own recording, a claim about the counterparty against their material. Unverified rubrics bill nothing.
- **A billing gate.** The charge is written exactly once, keyed on the call reference, and only by a grade that passed.
- **A chase cadence with an ending.** Cases chase what is outstanding on a schedule, and then are abandoned **with the reason and the list of what never came back**.
- **File storage that hashes what arrived** — not a description of it.
- **A board, a landing page, a self-test, and insights** — all reading the same rows the JSON routes return.

## Architecture

Convex is the entire backend: the ledger, the workflow, the scheduled sweeps, the HTTP hooks, file storage, and static hosting for the site. There is no server of ours to deploy, no queue to babysit, and no separate database to keep in sync.

```
        browser                      Convex                        the world
  ┌──────────────────┐     ┌──────────────────────────┐     ┌────────────────────┐
  │ landing          │     │ cases · verify · grade   │     │ the company's page │
  │ board            │◄───►│ orchestrator · chase     │◄───►│ their reply        │
  │ upload (client)  │     │ attachments · insights   │     │ the phone line     │
  └──────────────────┘     │ crons · http hooks       │     └────────────────────┘
        reads only         └──────────────────────────┘
   (never asserts a read)    every vendor call is an action or a
                             component call, so it lands in the same
                             transaction log as the thing it justifies
```

### The states a case moves through

```
OPEN ──► FROZEN ──► CHASING ──► VERIFIED
  │         │           │
  │         │           └──► ABANDONED   reason + what was never read back
  │         └──► DISPUTED               a closure withdrawn when it ages out
  └──► REFUSED                          a close attempt that could not be justified
```

### Component by component

| Piece | What it does |
|---|---|
| `convex/cases.ts` | Opens a case, freezes and hashes its requirements, closes it — only through the verifier |
| `convex/verifier.ts` | Re-reads the requirement and evidence rows every time it is asked; refusals name the requirement and the reason |
| `convex/orchestrator.ts` | The pipeline: read, extract, grade, meter, report — each step writing what it did |
| `convex/grades.ts` | Judges claims, prints its checks, and is the only thing that can release a charge |
| `convex/attachments.ts` | Uploads to storage, hashed from the bytes that arrived, matched by the same rule the close gate uses |
| `convex/chase.ts` | Asks what is outstanding, sends, and eventually abandons with a reason |
| `convex/insights.ts` | Outcomes rather than counts: time to closure, why closures are refused, who keeps coming back |
| `convex/selftest.ts` | The deployment checking itself, storage round trip included |
| `convex/http/*.ts` | The HTTP surface: reads anyone may make, hooks that run only with a shared secret |
| `convex/limits.ts`, `convex/lib/limits.ts` | The ceilings on those hooks, enforced through the rate-limiter component |
| `convex/integrations/*` | One module per vendor, each with a stubbed-transport test and a live probe |

### The HTTP surface

| Route | Method | Who may call it |
|---|---|---|
| `/health` | GET | anyone — which integrations carry a key |
| `/selftest` | GET | anyone — the deployment checking itself |
| `/cases`, `/case?ref=` | GET | anyone — the same rows the board renders, plus a `proof` block |
| `/dashboard` | GET | anyone — the board, served from static hosting |
| the board's actions | — | **an operator session only**: closing, reopening, spending a call, taking a file |
| `/hooks/call-ended` | POST | the call platform only, with a shared secret |
| `/hooks/inbound-email`, `/hooks/agentmail` | POST | the mail provider only, with a shared secret |
| `/hooks/vapi-tools` | POST | the voice assistant's tools only, with a shared secret |

## The close loop, step by step

1. **Freeze.** A reference, a company, what is owed, and the facts that must be true for the case to be over. The set is hashed at intake. The browser cannot rewrite it; the only thing a client may attach is the owner's own document.
2. **Read.** The server fetches, times, and hashes. A counterparty page, an inbound reply, a call transcript, an owner's file — each lands as evidence of its own kind.
3. **Grade.** Claims are extracted and judged one by one. A promise is checked against our own recording; a claim about the counterparty needs their record. The grade prints every check and names any that failed.
4. **Release.** A `pass` writes the charge **exactly once**, keyed on the call reference. A `fail` writes nothing. Either way the outcome is on the case and in the audit trail.
5. **Chase, then stop.** Nothing outstanding means no chase. Something outstanding chases on a cadence, and after the last attempt the case is abandoned with the reason and the list of what never came back.

## Where the guarantee is enforced

| The guarantee | Enforced in | Covered by |
|---|---|---|
| A requirement set cannot be rewritten after intake | the freeze, and the hash stored with the case | a changed set produces a different hash |
| Evidence only counts if it was read after the case opened | the verifier, on every ask | a read from before the freeze never satisfies |
| A claim about the counterparty needs the counterparty's material | the authority rule | an owner's file cannot satisfy a requirement asking for the other side's |
| A charge cannot be written without a passing grade | the billing gate | a missing grade bills nothing; a failed grade bills nothing |
| A charge cannot be written twice | the exactly-once key | a replayed webhook does not bill again |
| An unrun check cannot pass | the grade's rubric | an unchecked rubric item is unverified, and unverified bills nothing |
| Hooks cannot be forged | the shared secret, fail-closed | a hook without the secret is refused |

## What the grade measures

- **Whether the evidence was read after the case opened** — the freshness rule, applied per requirement.
- **Whether it came from the right side** — a promise is ours to prove, a claim about them is theirs.
- **Whether the kind matches** — a page read cannot satisfy a requirement that asks for their reply, and vice versa.
- **Whether every rubric item was actually checked** — anything the grader could not check is reported as unverified, and unverified bills nothing.
- **Whether the case may close** — which is a separate decision from whether it may bill, and a case can be refused a closure for weeks while the charge stays unwritten.

## Where the model sits

The model does one job: turn a transcript into claims, at zero temperature, in a fixed shape. It cannot cast a verdict, cannot close a case, and cannot write a charge — a claim is not allowed to carry its own verdict.

The reader is a list, not a constant (`convex/integrations/readers.ts`). The event's own stack leads, a second reader the operator subscribes to follows, and a provider that refuses — no key, no quota, an outage, a model id that has moved — is a fact about that provider rather than the end of the run. Every refusal is reported with the provider's own words, and a run where all of them refuse says so instead of producing an empty case. Which reader answered is written on the case as `read_by`, so a claim can be traced to the thing that read it rather than to "a model".

The model is still the fallback: the pipeline prefers the call platform's own end-of-call analysis, so it can decide money with no model key present at all. That is why the `402` above is an inconvenience rather than a blocker, and why the fall-through exists rather than a retry.

## Who approves what

| Action | Who can do it | What it can change |
|---|---|---|
| Open a case, freeze its requirements | the owner | the ledger, before anything is filed |
| Upload the owner's own document | the owner, from the client | evidence of kind `own_document` only |
| Read a page as evidence | an operator action | evidence of its kind, filed with the time and the hash |
| File a claim about the counterparty | the ingest path only | claims attributed to the counterparty |
| Close a case | the verifier alone | state only — and only when the requirement is satisfied |
| Release the charge | the grade, on a pass | the billing row, once |

## Engineering decisions & the traps that taught me something

- **A state you can name but never reach is a lie in the schema.** `CHASING` was declared and drawn, and nothing ever entered it: there was no code that would ever chase. It now schedules its own first chase when requirements freeze, sweeps hourly, chases three times at most, and then abandons with a reason.
- **Write the pointer in the same transaction as the move.** A case could reach `VERIFIED` while its requirement still read `unsatisfied`, because the pointer was written by a second call. Two writes that must agree belong in one transaction.
- **A grade belongs to the thing it judged, and the view has to ask the same question.** Grades were recorded against the call while the case view asked at case level, so a graded case rendered with no grade on it. The query was fixed and a regression test added.
- **A build that succeeds while producing nothing is worse than a build that stops.** The board deployed once with no deployment address: the export succeeded, the upload succeeded, and the site opened saying "No backend is configured". The build now refuses without it and says where to put it.
- **A moving picture that ends before its narration freezes on screen.** The video assembly now refuses to cut a motion segment shorter than the line it carries — it caught one on the first run.
- **A capture of the wrong shape fills the frame or fails.** A 1280×577 screenshot cropped into a 1920×1080 frame produced a segment with no video stream; stills are now scaled to cover whatever shape they arrive in.

## What's real vs pending — the honesty table

| Thing | State |
|---|---|
| Case state machine, verifier, requirement freezing and hashing | Real, covered by tests |
| Claim verdicts, evidence freshness and authority rules | Real, covered by tests |
| Billing gate, exactly-once charge | Real, covered by tests |
| The chase cadence, and abandoning with a reason | Real, verified live |
| Webhooks | Real, fail-closed without the shared secret |
| File uploads | Real: uploaded, hashed from the bytes, readable again |
| Firecrawl, AgentMail, the call platform, metering, tracing | Keyed and exercised live |
| OpenAI extraction | Keyed, and first in the chain; it answers `402 insufficient_quota` until the quota refills on 24 September 2026. The chain falls through rather than stopping: verified live, a transcript read by the second reader with the run recorded as `read_by: router`. The pipeline also prefers the call platform's own reading of the call, so nothing here depends on a model |
| Inkeep | Off: that account belongs to no organization. `/health` reports it `false` |
| Dialling out anywhere | Refused by the phone platform's own daily limit on purchased numbers. Inbound works, and the board shows the platform's own sentence verbatim rather than pretending the call happened |
| The assistant never stating an unread number | Mechanism in place, not yet exercised on a live call |
| The board, health, self-test, and both JSON routes | Live, and every row above was run against them |

No screen in this project renders a value that did not come from a real read.

## Attack → test

| The attack | The test that answers it |
|---|---|
| File a hook without the shared secret, hoping a forged "call ended" closes a case | `refuses a call webhook outright when no secret is configured, instead of accepting it` |
| Replay a webhook to bill twice | `bills once behind a passing grade, and a replayed webhook does not bill again` |
| Satisfy a requirement with your own file when it asks for theirs | `does not let an owner's file satisfy a requirement that asks for the other side's` |
| Read evidence from before the case opened | `accepts evidence read at the moment the case opened`, and refuses anything earlier |
| Satisfy a requirement with a forum post or a model's summary | `does not count a forum post or a model's summary` |
| Let a claim carry its own verdict | `does not let a claim carry a verdict of its own` |
| Write a charge with no grade behind it | `a missing grade can never bill` |
| Leave a rubric item unchecked and hope it passes | `an unchecked rubric item is unverified, and unverified bills nothing` |
| Move the goalposts after the fact | `gives a different hash when the set actually differs` |
| Chase a case that nothing is outstanding on | `does not chase a case that nothing is outstanding on` |
| Let a case run forever rather than admit defeat | `abandons a case once the cadence has run out, naming what was never read back` |
| Open a case with a reference that cannot be one | `does not accept a reference with punctuation that cannot be a case` |

## The app

The board lists every case it has touched, newest first, with the outcomes counted from the same rows the list renders. A case opens into its requirements, the evidence read back, the claims filed against it, the grade with its checks, the charge, and the audit trail — with the operator actions that can add evidence, and a refusal that names the requirement when you ask it to close too early. Every case has `this record as JSON →`.

The landing page states what is verified and what is not, side by side, because a product whose whole argument is "prove it" should not hide its own gaps.

## Limitations

- **One operator.** There is no multi-user model: no roles, no seats, no sharing. The mailbox is the case's, and the person running it is you.
- **The refusal that has not been exercised on a live call.** The assistant is instructed never to state a number it has not read; the mechanism is in place, and it has not yet been tested against a real caller who tries to get it to guess.
- **No real debtor.** Every case on the deployment was created by driving the product, which is what "no sample data" means here: the records are real records of a real deployment, made against a counterparty that does not owe anyone anything.
- **OpenAI and Inkeep** as the honesty table describes.
- **Nothing here is legal advice**, and a case file is not a claim in a court.

## Security

- **Hooks fail closed.** Every `/hooks/*` route requires a shared secret and refuses without it, so a forged "call ended" cannot close a case or move money.
- **Secrets never touch a command line.** Deployment variables are pushed with `env set --from-file`; the values live in `.env.local` (git-ignored, mode 600). Nothing secret is printed, logged, or returned by `/health`, which reports presence rather than values. The operator passphrase exists on the deployment only as a hash: it is set from the board when a deployment is claimed, and changed from the board while signed in, which ends every other session.
- **The browser is not trusted.** Reads happen on the server. The client can attach the owner's own document and nothing else; it cannot assert what a page said.
- **Uploads are bounded.** A type or size the rule does not accept is refused with the reason, and a refused upload is deleted rather than left in storage.
- **The money path is keyed.** The charge is written once, keyed on the call reference, so a retry or a replay cannot bill twice.
- **The board is a subscription, not a snapshot.** It reads the deployment's rows and re-renders when they change, so a case that a webhook moves, a cron sweep chases, or another tab closes appears without a refresh.
- **The board is a subscription, not a snapshot.** It reads the deployment's rows and re-renders when they change, so a case a webhook moves, a sweep chases, or another tab closes appears without a refresh.
- **The hooks are bounded.** Each carries its own shared secret, and each spends from two token buckets — one per case and one for the deployment — so a provider retrying or a loop in someone else's cron cannot hammer a case or the deployment. A flood aimed at one case does not touch another case's allowance.

## How each sponsor is used

The three the event names, first, because the criterion is that they do real work rather than sit
in the README. Every row below is a call the product makes while a case is being worked, and the
last column is where it lives.

| Sponsor | What it does in a live run | Where |
|---|---|---|
| **OpenAI** | Reads a call transcript into claims: what the caller wanted, what was promised, what was stated as fact, resolved or not. Temperature 0, fixed shape, and it is never asked whether a claim is true. First reader in the chain, with `read_by` recorded on the case | `convex/integrations/readers.ts`, called from `convex/orchestrator.ts` |
| **Firecrawl** | Reads the counterparty's own page as evidence when an operator asks for a read, and on the hook path. Stored with the URL, the time it was read and the hash of what came back, as `page_fetch` from the counterparty | `convex/board.ts` (`readSource`), `convex/http/hooks.ts`, `convex/integrations/firecrawl.ts` |
| **AgentMail** | The case's mailbox. It sends the report to the counterparty and the chase when a case is stuck, and the reply that comes back is ingested as `email_reply` from the counterparty, one of the two kinds either side's own record can carry (the other is a page read from their own site) | `convex/orchestrator.ts`, `convex/chase.ts`, `convex/http/hooks.ts`, `convex/ingest.ts` |

Then everything else that is wired, so the deployment's own report is not a mystery.

| Integration | What it does | Where |
|---|---|---|
| **Convex** | The database and the whole engine: queries, mutations, actions, HTTP routes, scheduled functions, file storage, and the app's own hosting. The board is a live subscription, so a case that moves in another tab, from a webhook or on the sweep appears without a refresh | `convex/schema.ts`, `convex/cases.ts`, `convex/orchestrator.ts`, `convex/crons.ts`, `convex/http/*.ts`, `convex/attachments.ts` |
| **Vapi** | The case's phone line. A finished call arrives on the hook and its transcript is filed as `call_transcript`. The assistant's two tools reach the backend and only the backend, so it cannot state a number that was never read | `convex/integrations/vapi.ts`, `convex/http/hooks.ts`, `convex/ingest.ts` |
| **Autumn** | Meters a resolution, and only when a grade passes. A failed or unverified grade bills nothing | `convex/orchestrator.ts` (`trackUsage`) |
| **Scorecard** | Receives the trace of a graded run over OTLP, so a grade that decided money left a record elsewhere too | `convex/integrations/scorecard.ts`, `convex/orchestrator.ts` |
| **Resend** | The mail fallback: used when no receiving mailbox is configured, in which case nothing can come back and the pipeline says so | `convex/chase.ts`, `convex/orchestrator.ts` |
| **rate-limiter** (Convex component) | Every public hook spends from a token bucket: per case and per deployment, plus a budget for operator actions. A burst that exceeds it is refused with the limit named | `convex/convex.config.ts`, `convex/lib/limits.ts`, `convex/limits.ts` |
| **Inkeep** | Off. That account is not a member of an organization, so the integration cannot be exercised and `/health` reports it as `false` rather than pretending | `convex/integrations/inkeep.ts` |

`/health` reports what carries a key, and which readers would actually read a transcript and in what
order. That report is a request away, which is the point.

## Tech stack

**Backend** Convex — database, functions, crons, HTTP actions, file storage, static hosting, and two components (static hosting, rate limiter) · **Frontend** Next.js App Router, static export · **Language** TypeScript end to end, types generated from the schema · **Tests** Vitest, 200 across 26 files · **Sponsors** OpenAI, Firecrawl, AgentMail · **Also wired** the call platform, metering, tracing.

## Project layout

```
convex/            the case, the pipeline, the gates, the adapters, the routes
frontend/          the site: the landing page and the board
demo/              the demo video and the click sheet
tests/             200 tests across 26 files
docs/              integrations, deployments, the demo, what a live run printed
scripts/           deploy, the live end-to-end run, the video assembly
hackathon.md       the build log, including what a live deployment found
```

## Full command reference

```bash
npm test                      # the rules, 200 tests, no vendor keys needed
npm run typecheck             # no errors
npx convex dev                # the backend, against your own deployment
cd frontend && npm run dev    # the site (build refuses without NEXT_PUBLIC_CONVEX_URL)

./scripts/deploy.sh           # functions + deployment variables, then /health
cd frontend && npm run build && npx @convex-dev/static-hosting upload -d out

python3 scripts/live_e2e.py   # a real case, three ways, against the deployment
npx convex run selftest:run   # the same self-test, from the CLI
```

## How I'd deploy it

Point `CONVEX_DEPLOY_KEY` at a production deployment, run `./scripts/deploy.sh`, build the site with `NEXT_PUBLIC_CONVEX_URL` set to that deployment's cloud URL, and upload the export. Then set the hook secrets, point the call platform and the mailbox at the deployment's HTTP actions, and put an auth layer in front of the board before letting anyone else touch it. The variables it wants are all named in `/health`'s output when they are missing.

The operator passphrase works the other way round: only its **hash** is stored, and normally
it is set from the board itself. A deployment with no passphrase is *claimable* — the first
person to open `/dashboard` is asked to choose one, and once it exists that form is gone for
good. That is the whole setup: no terminal, no env file.

For setting one up from a shell instead, or rotating a forgotten one:

```bash
./scripts/set-operator-passphrase.sh      # asks twice, hashes locally, pushes the hash only
```

A passphrase set from the board wins over one in the environment, and either can be changed
while signed in, under **Integrations → The operator's passphrase**. Changing it ends every
other session, because a new passphrase is also a revocation.

`--dry-run` shows what it would write without writing it. Change it after any recording in
which the passphrase is visible — on camera, a passphrase is published.

## Results and supporting records

- **[The demo](https://youtu.be/AYrAlrk17Yk)** — 1:36 of the live deployment being driven, one session, with the pointer where the press landed. A local copy is committed at [demo/bailiff-recorded.mp4](demo/bailiff-recorded.mp4).
- **[`hackathon.md`](hackathon.md)** — the build log, including what a live deployment found that tests did not.
- **[`docs/evidence/`](docs/evidence)** — the last test run, typecheck, and site build, as they printed.
- **[`docs/DEMO.md`](docs/DEMO.md)** — how each cut was assembled, and how to rebuild it.
- **[`demo/CLICKS.md`](demo/CLICKS.md)** — the demo written as clicks and lines.
- **The deployment itself** — `/health`, `/selftest`, `/cases`, and any case as JSON.

## Tests

```bash
npm test                       # 200 tests across 26 files
```

Each integration has a stubbed-transport test *and* a live probe, so the code is covered without pretending a vendor was reached. The rules that decide money — evidence freshness, authority, the grade, the exactly-once charge — are tested per rule rather than per file, because a rule with no test is a rule you are only claiming.

## License

MIT — see [LICENSE](LICENSE).
