# Hackathon log

- **Project:** Bailiff
- **Event:** Convex All Gas Hackathon
- **What it does:** A case against a company that owes you stays open until their own
  record shows the outcome. The requirement set is frozen at intake and hashed, every
  read is stored with its source and the time it was read, and nothing can be called
  done because someone said so.
- **Stack:** Convex (ledger, workflow, crons, HTTP hooks), OpenAI (transcript to
  claims), Firecrawl (reads the counterparty's own pages), AgentMail (the case's
  mailbox: sends the report, receives the reply that becomes evidence).
- **Live app:** https://aware-jellyfish-285.convex.site — landing, the board, `/health`,
  and the JSON routes `/cases` and `/case?ref=`. Every claim in this repository was
  checked against that deployment, not against a local run.
- **Demo video, click-through:** [demo/bailiff-clickthrough.mp4](demo/bailiff-clickthrough.mp4) — 61 seconds, twelve real interactions with a caption on each: the board, a case that closed, a case refused, a document hashed as it arrived, the self-test, the same rows over HTTP. Captured while the deployment was driven by hand.
- **Demo video, explainer:** https://youtu.be/nlCXhzFYia4 — 100 seconds, the same product with the reasoning. Committed at [demo/bailiff-demo.mp4](demo/bailiff-demo.mp4). The open and the close are rendered motion pieces; everything between them is the live deployment, captured while it was driven by hand. Shot by shot in `demo/SCRIPT.md`.
- **The motion piece on its own:** [demo/hyperframes-narrated.mp4](demo/hyperframes-narrated.mp4) — 35 seconds, the opening and closing pieces with narration, for posting. The silent cut is [demo/hyperframes.mp4](demo/hyperframes.mp4).
- **The demo, for anyone recording it:** [demo/CLICKS.md](demo/CLICKS.md) — every click and every line, in order.
- **Repo:** [github.com/subheeksh5599/bailiff](https://github.com/subheeksh5599/bailiff), public.
- **Social proof:** the build is posted at [https://x.com/KomariS18774/status/2102368912549753004](https://x.com/KomariS18774/status/2102368912549753004).

### The click-through, recorded from real input events

`demo/bailiff-recorded.mp4` (96s) is a capture of the live deployment being driven: the frames
are Chrome's own screencast, and every click is a dispatched mouse event at the element's real
coordinates, so the pointer marks where the press actually landed. Frames arrive when the page
repaints, so each one is held for the interval it was genuinely on screen — a burst is motion, a
gap is stillness. `scripts/record_demo.py` performs the session; `scripts/assemble_recording.py`
cuts it and places each narration line at the moment its step began.

## What is real right now, and what is not

| Piece | State |
|---|---|
| Case state machine, verifier, requirement freezing and hashing | Real, covered by tests |
| Claim verdicts, evidence freshness and authority rules | Real, covered by tests |
| Billing gate, exactly-once charge, retry of a failed delivery | Real, covered by tests |
| Webhooks (call ended, inbound mail, assistant tools) | Real, fail-closed without the shared secret |
| Hook rate limits | Real: the rate-limiter component is mounted and every hook spends from a per-case and a deployment-wide token bucket. A 16-request burst was refused live with the limit named |
| Claiming a deployment | Real: a deployment with no passphrase lets the first visitor set one from the board and become the operator; a second claim is refused, and only the hash is stored |
| Operator sessions | Real: a passphrase is exchanged for a token stored only as a hash, sessions expire, and every action that closes, charges, dials or takes a file refuses without one. The reads stay public |
| Daily re-check withdrawing an aged closure | Real, covered by tests |
| Firecrawl reads | Keyed and reachable (verified against the vendor) |
| AgentMail send + inbound reply | Real: the report is sent and the reply that comes back becomes evidence. Verified live, message id and all |
| Extraction (OpenAI) | Keyed and reachable; the provider answers `402 insufficient quota` until credits land on the 24th, and that refusal is recorded on the case as `extraction.failed` |
| Metering (Autumn) | Keyed and reachable (verified) |
| Telephony (Vapi) | Real: a number answers on this project's own assistant, which carries the server URL, the shared secret and both tools. Outbound is refused by the platform's own daily limit; inbound is what the demo uses |
| Live URL | Live, and every row above was run against it |
| Inkeep | Off: that account is not a member of any organization, so the integration cannot be exercised. `/health` reports it as `false` rather than pretending |

Nothing above is claimed as proven that has not been run, and no screen in this
project renders a value that did not come from a real read.

## How the mechanism works

1. **Open a case.** A reference, a company, what is owed.
2. **Freeze the requirements.** The facts that must be true for the case to be over,
   hashed at intake. The browser cannot rewrite them; only the customer's own
   documents can be attached from the client, and anything speaking for the
   counterparty arrives only through the ingest path.
3. **Read.** Firecrawl reads the company's own page and the value is stored with its
   source and the time it was read.
4. **Try to close.** A case reaches `VERIFIED` only through the verifier, which
   re-reads the requirement and evidence rows every time it is asked. Refusals name
   the requirement and the reason, and are written to the case's diary.
5. **Grade.** A call's transcript is hashed and its claims extracted; promises are
   checked against the recording, statements of fact against a record. A statement
   with no record behind it is `unverifiable`, which is not a soft failure: it bills
   nothing.
6. **Charge once, or not at all.** Only a passing grade releases a meter event, and
   the billing row cannot exist without that grade in the same transaction. The
   idempotency key is the call's own reference.
7. **The closure can come back.** A daily re-check re-examines verified cases; when
   the evidence that closed one has aged out, the closure is withdrawn and the reason
   recorded. A "done" that cannot come undone is a claim, not a fact.

## Build log

Every step below is a commit in this repository, in order.

- 2026-09-21  Import the locked landing and app design, unmodified
- 2026-09-21  Rewrite the imported copy from clinical language to our own domain
- 2026-09-21  Say it in our own words: outcome, counterparty, closed
- 2026-09-21  A third party's page cannot satisfy a requirement
- 2026-09-21  Grade a call in one place, and prove the billing gate end to end
- 2026-09-21  Regenerate the API after adding the grades module, and teach tsc about vite globs
- 2026-09-21  Ingest the calls and emails that actually happened, and re-check the closures
- 2026-09-21  A browser cannot write the evidence that closes its own case
- 2026-09-21  Adapters for the vendors, one place where state changes
- 2026-09-21  Next.js app: the imported design, ported and building
- 2026-09-21  The assistant's tools, and the vendor layer under test
- 2026-09-21  Ignore build output and local state, so the repository holds only source
- 2026-09-21  The board, the demo pipeline and the documents
- 2026-09-21  Render the unconnected board without hooks, and commit the evidence
- 2026-09-21  Correct the build evidence: it was captured from the failing run
- 2026-09-22  A failed run is a fact on the case, not a stack trace
- 2026-09-22  One-command deploy, and an agent string that is configuration
- 2026-09-22  AgentMail, chosen because a case needs the reply back

## Commands

```bash
npm install          # convex, vitest, convex-test, typescript
npm test             # 184 tests, no vendor keys needed
npm run typecheck
npx convex dev       # backend
cd web && npm install && npm run dev   # landing + case board
./scripts/deploy.sh  # push functions and deployment variables (needs CONVEX_DEPLOY_KEY)
```

## Where to look

- `README.md` — the claim, the invariants, and the honesty table.
- `docs/INTEGRATIONS.md` — what each integration does and what happens when its key is missing.
- `docs/DEMO.md` — the demo as delivered, and how to rebuild it. `docs/RUNOFSHOW.md` — the live session plan. `demo/` — the video, the stills it was cut from, the narration.
- `convex/lib/rules.ts` — the freshness, authority and grade rules, as pure functions.
- `convex/verifier.ts` — the only path to a closed case.
- `convex/billing.ts` — the gate, in one mutation, with the idempotency key.
- `tests/` — 184 tests across 25 files; the ones that matter defend the three invariants above.

## Live, and the four things a live deployment found

The backend, the environment and the site now live on one deployment, so a judge opens
one address. Getting there turned up four defects that no amount of local testing had
shown, which is the argument for deploying before writing anything else:

1. Every call-to-action on the landing pointed at a filename from the imported design
   that was never a route in this app: four dead buttons, on the most prominent element
   of the page.
2. The grading integration named a host that answers us with a TLS failure, and an
   endpoint that does not exist on that platform's API at all. Both were replaced with
   values read out of the platform's own SDK, and the delivery was rebuilt around the
   mechanism its documentation describes.
3. The meter had no feature to count against and no customer to count for, so every
   passing resolution would have failed on a missing feature rather than being billed.
4. The site's nested page was unreachable: the hosting layer serves exact paths and
   falls back to the landing for anything else, so the board never resolved. The links
   now point at the path that is actually served, verified by fetching it.

Each of these is the same lesson: a claim about a deployed system is worth exactly what
was observed on the deployed system. Everything asserted in this document was observed
on the live URL, including the failures still standing - extraction stops with the
provider's quota error recorded on the case, and knowledge reports itself off rather
than pretending.

## The pipeline run three ways on the deployment

Local tests prove the rules; only a real run proves the wiring. `scripts/live_e2e.py` opens
cases on the live backend, posts real webhook traffic signed with the shared secret, and runs
the pipeline end to end. Three calls, chosen to sit on either side of the line that matters:

- a call whose only claim was a promise: graded pass, and the charge released - which is the
  only thing that releases it;
- a call asserting what the counterparty had already done: graded fail on a statement with no
  record behind it, and the charge untouched, however confidently it was said;
- a case whose requirement was met by a reply that arrived after the case opened: closed, with
  the requirement pointing at the evidence that closed it.

That last one found a defect worth fixing: the case moved to verified while the requirement it
closed on still read unsatisfied. One question, two answers, and the board reads that flag - so
the pointer is now written in the same transaction as the move, and a test holds it there.

A second source of claims was added on the same run: the call platform's own reading of the
call, carried in its end-of-call report. It comes from the call itself, in the same system, so
it is preferred over a second model's pass over the same text - and it means the pipeline has no
dependency on a model key to decide whether money moves. The model remains the fallback.

## The state the machine declared and nothing ever entered

Auditing the product against its own opening paragraph turned up a hole: `CHASING`
was a legal state, with legal transitions in and out of it, that nothing ever moved a
case into. A frozen case with an outstanding requirement sat there indefinitely -
which is exactly the problem this product is about, reproduced inside it.

So the cadence is now real and finite. A case schedules its own first chase the
moment its requirements are frozen; an hourly sweep finds anything the scheduler
missed; and the chase goes out every two days, at most three times, after which the
case is abandoned with the reason and the outstanding requirements recorded. No mail
path means no chase and no state move - a case is never advanced on the strength of a
message nobody sent.

Testing it found a second hole in the same minute: `REQUIREMENTS_FROZEN -> ABANDONED`
was not a legal move, so a case whose requirements would never be read back could not
be given up on before it had been chased. That transition exists now, and the states
test holds it.

Verified on the live deployment rather than in a test: with the clock moved three days
on, the chase was sent and accepted, the case moved to `CHASING`, its diary recorded
`chase.sent` with the outstanding requirement named, and a second run answered
`next chase in about 48h`.

## Filling the hole the score would never have shown me

Measuring the repo against the same rubric as the rest of the field said the only
term we were short on was surface area, which is a terrible reason to write code. So
the work was chosen by asking what the product genuinely could not do yet, and every
piece of it turned out to be something the honest version of this product needs:

- **Files.** A statement is a PDF or a photo of a screen, not a paragraph somebody
  retyped. Uploads now go to Convex file storage, the bytes are hashed as they
  arrived rather than a description of them, and the row on the case offers the file
  back. Types and sizes are checked with a refusal that says which rule it tripped,
  and a rejected upload is removed rather than left in storage.
- **A self-test.** The landing page claims a reader can check three things with
  curl; now one call asks the deployment everything, including whether storage can be
  written to and read back. A check that cannot run reports itself skipped — never a
  pass, which is the failure mode this whole product is built against.
- **Insights.** "Is this working and where is it stuck" finally has an answer on
  screen: median hours to closure, why closures are refused, ranked, chases sent, and
  who keeps coming back. All computed from the same rows the list renders.
- **One place that writes what the product says.** The call report, the chase and the
  abandonment notice were three inline strings; they are now built side by side with
  the rules they describe, each carrying the case reference that makes a reply into
  evidence.
- **The routes, split by who calls them.** Reads anyone may make, and hooks that only
  ever run with a shared secret — two files instead of one 330-line file, and the
  router reduced to the order that matters.

Verified on the live deployment: the self-test reports nine integrations on, storage
written and read back, 20 cases readable; a real text file was uploaded through the
board, hashed from its bytes, filed as the owner's own record and offered back for
download; and the numbers read the states, the refusals and the chases off the real
case rows.

- 2026-09-22  The demo, and the three things watching it found: two scenes of the motion
  piece rendered black because only the children were animated inside a transparent
  container (a linter cannot see an invisible scene, so this is exactly what looking at
  the output is for); a requirement read "satisfied by email_reply" beside an
  outstanding badge, which is the evidence kind it *needs*, now phrased that way; and
  the closing card claimed no sample data while the footage showed `example.com`, so the
  claim is now the precise one. Rebuilding the site to fix the copy also caught a fresh
  build deploying with no deployment address at all — export fine, upload fine, site
  empty — which is now a build-time refusal, and a 1280x577 capture being cropped into
  a 1920x1080 frame, which produced a segment with no video stream.

- 2026-09-22  The last technical work, and what watching it found: the operator's board
  is now behind a session (the reads stay public), the public hooks spend from two token
  buckets so a flood on one case cannot spend another case's allowance, and the board
  says out loud that it is a subscription. That last claim was checked rather than
  asserted: a case opened in a second tab appeared in the first with no reload. The first
  reading was "still 20 cases" and the cause was a backgrounded tab having its socket
  throttled, which is the browser's business, not the product's.
