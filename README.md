<div align="center">

<img src="docs/screenshots/landing.jpg" alt="The landing page: a case closes when the outcome is verified" width="100%" />

<br /><br />

# Bailiff

**A case against a company stays open until their own record shows the outcome, and a charge is released by a grade that passes — never by a note.**

[![deployment](https://img.shields.io/website?url=https%3A%2F%2Faware-jellyfish-285.convex.site&label=deployment&up_message=live&down_message=down)](https://aware-jellyfish-285.convex.site)
![tests](https://img.shields.io/badge/tests-116%20passing-3fb950)
![integrations](https://img.shields.io/badge/integrations-9%20of%2010%20on-3fb950)
![licence](https://img.shields.io/badge/licence-MIT-blue)

Built on Convex · Vapi · Firecrawl · AgentMail · OpenAI · Scorecard · Autumn

**[Live deployment](https://aware-jellyfish-285.convex.site)** · **[Case board](https://aware-jellyfish-285.convex.site/dashboard.html)** · **[Health](https://aware-jellyfish-285.convex.site/health)** · **[Cases as JSON](https://aware-jellyfish-285.convex.site/cases)**

</div>

## Contents

- [What it does](#what-it-does)
- [The three rules](#the-three-rules)
- [Money](#money)
- [The board](#the-board)
- [Demo](#demo)
- [Integrations](#integrations)
- [Verify it yourself](#verify-it-yourself)
- [Run it](#run-it)
- [Repository layout](#repository-layout)
- [Honesty table](#honesty-table)

## What it does

Getting money or a correction out of a company is email work with no end condition. A ticket can be marked resolved without the refund existing. An agent can say "it was issued on the 20th" and be wrong, and there is no way to tell a promise from a record.

Bailiff is a case that cannot be closed that way.

A case is opened with a **frozen requirement set** — the specific things that must be true for it to be over — hashed before any call is placed. Every piece of evidence carries where it came from and when it was read. Every statement becomes a claim with a verdict derived from that evidence. Only the verifier moves a case to `VERIFIED`, and it re-reads the requirement and evidence rows each time rather than trusting a stored flag.

The browser can never write the evidence that closes its own case: it may attach the customer's own documents, and nothing else. Anything speaking for the counterparty arrives only through the ingest path — a page read on the server, a reply the mailbox received, or a call's transcript.

## The chase, and its end

An open case that nothing is doing about is a lie the board would otherwise keep
telling. So a frozen case chases itself: the first chase is scheduled the moment its
requirements are frozen, a sweep runs hourly so a case frozen before this existed is
still found, and the cadence is finite and written down — chased every two days, at
most three times.

A chase goes to the counterparty's contact when the case carries one, and to the
owner when it does not, and the audit says which. No mail path means no chase: the
case is not advanced and the missing variable is written down rather than moving a
case on the strength of a message nobody sent. When the cadence runs out the case is
**abandoned**, with the reason and what was never read back recorded — instead of
sitting open forever looking like work in progress.

## The three rules

1. **A claim is verified only by evidence read after the case opened.** A third party's page can corroborate a requirement but can never satisfy one, so a forum post cannot close a case about someone else's money.
2. **A case closes only when every frozen requirement is satisfied**, each by evidence of the same kind. Refusals name the requirement and the reason, and the refusal is written into the case's own diary.
3. **A closure is not permanent.** A daily re-check re-examines verified cases; when the evidence that closed one has aged out, the closure is withdrawn, the case returns to dispute, and the reason is recorded.

## Money

A phone line opens cases, and the board can dial one: the case reference travels in the call's metadata, which is how the finished call finds its way back to the right case. Nothing is stated on that call that was not fetched first and filed against the case: the assistant's only route to a value is a tool that reads and records.

When the call ends, its claims are put against three checks that are printed on the case:

```
promises_on_record   a promise is checked against our own recording
unverified           a statement about their behaviour needs their record
resolved             whether the caller's problem was actually dealt with
```

Only a passing grade writes a billing row, and the row cannot be written without that grade in the same transaction. The idempotency key is the call's own reference, so a replayed webhook re-reads one row instead of charging twice. A meter that cannot be reached leaves the row **pending**, never quietly free.

## The board

<img src="docs/screenshots/board.jpg" alt="The case board: cases, their states, and what each one owes" width="100%" />

Every case the pipeline has touched, newest first. The counts above the list are computed from the same rows the list renders, so they cannot disagree with what is underneath them.

<img src="docs/screenshots/case.jpg" alt="One case: frozen requirements, the evidence that closed it, the grade and the charge" width="100%" />

One case, with the requirement set it was frozen on, the evidence read back, the claims and their verdicts, the grade check by check, and what that grade released. An operator can start the call the case is built around, read a page as evidence, file the owner's own document, run the pipeline on a call, attempt a close and read the refusal in the backend's own words, or reopen a settled case as disputed. A settled case refuses new evidence and says why rather than disabling a control silently.

<img src="docs/screenshots/integrations.jpg" alt="Integrations: what carries a key, what does not, and the commands that show both" width="100%" />

## Demo

A recorded walkthrough goes here. **It is not recorded yet, and this section will say so until it is.** Until then the live deployment is the demo: open [the case board](https://aware-jellyfish-285.convex.site/dashboard.html), open a case, and read what closed it.

## Integrations

Every vendor call happens inside a Convex function, never in the browser and never in a route handler, so it lands in the same transaction log as the thing it justifies. A missing key is not approximated: the integration reports itself off and the pipeline stops at that step with the variable named on the case.

| Piece | What it does | Verified on the deployment |
|---|---|---|
| Convex | The case, the evidence, the audit trail, every state move | Yes |
| Vapi | The phone line: two tools, and the platform's own reading of the call | Yes |
| Firecrawl | Reading a page as evidence, with the time it was read | Real page fetched, text returned |
| AgentMail | The mailbox a case writes to and reads from | Real message sent, message id acknowledged |
| OpenAI | Reading a call into claims, when the platform did not | Keyed; provider answers `402` until credit lands |
| Scorecard | An outside evaluator receives the same graded run | Run delivered, acknowledgement received |
| Autumn | Metering a released charge | Metered event accepted |
| Inkeep | Grounding during a call | Off: the account has no organization to attach it to |

## Verify it yourself

Every claim here is checkable from a terminal. These are reads; none of them can write, close a case, or move a charge.

```bash
curl -s https://aware-jellyfish-285.convex.site/health
# { "ok": true, "integrations": { "convex": true, "firecrawl": true, …,
#   "knowledge": false } }

curl -s https://aware-jellyfish-285.convex.site/cases
# [ { "ref": "case-2026-0914-0188", "state": "VERIFIED", … } ]

curl -s "https://aware-jellyfish-285.convex.site/case?ref=case-2026-0914-0188"
# { "case": { "state": "VERIFIED", … },
#   "requirements": [ { "key": "refund_moved", "satisfied": true,
#     "satisfiedByEvidenceId": "js7954adh72r937s80c8kxz1v98ewz7p" } ], … }
```

`knowledge` reporting `false` is the point of that first command: what is off is reported rather than hidden.

## Run it

```bash
git clone https://github.com/subheeksh5599/bailiff && cd bailiff
npm install && npm test                      # 116 tests; no vendor keys needed
npm run typecheck

npx convex dev                               # the backend, on a local deployment
cd frontend && npm install && npm run dev    # the site and the board
```

`frontend/.env.local` needs one line — `NEXT_PUBLIC_CONVEX_URL` — or the board says no backend is configured and shows nothing. That is deliberate: there is no sample data anywhere in this repository.

To deploy the way the live one is deployed:

```bash
npx convex dev --once                                   # functions and the hosting component
npx convex env set --from-file .env.deployment          # the environment, in one write
cd frontend && NEXT_PUBLIC_CONVEX_URL=… npx next build  # the static export
npx @convex-dev/static-hosting upload -d frontend/out   # the site, served by the same deployment
```

## Tests

```
tests/rules.test.ts          claim verdicts, freshness, authority, requirement matching
tests/states.test.ts         the state machine and which moves are guarded
tests/hash.test.ts           requirement-set hashing
tests/analysis.test.ts       reading the call platform's own analysis of a call
tests/chase.test.ts          the cadence: when to chase, when to stop, and giving up
tests/integration.test.ts    open, freeze, read back, close — and the refusals between
tests/hooks.test.ts          the webhooks, signed and fail-closed
tests/pipeline.test.ts       grade, billing, mail, and every stop by name
tests/agentmail.test.ts      the mail path and where a report goes
tests/export.test.ts         what a case export contains
tests/integrations.test.ts   the request each vendor adapter builds
```

## Repository layout

```
convex/            the case, the pipeline, the vendor adapters, the HTTP routes
  lib/             rules, states, hashing, config, the platform-analysis reader
  integrations/    one adapter per vendor; adapters talk to vendors and nothing else
frontend/          the site: the landing page, and the board
  app/             the marketing page, and the board as one exported page
  components/      the design system and the board's screens
tests/             116 tests
docs/              integrations, deployments, the demo beat sheet, run output
scripts/           the live end-to-end run, the demo pipeline, deployment
hackathon.md       the build log, including what a live deployment found
```

## Honesty table

| Piece | State |
|---|---|
| Case state machine, verifier, requirement freezing | Real, covered by tests |
| Claim verdicts, evidence freshness and authority rules | Real, covered by tests |
| Billing gate, idempotency, retry of a failed delivery | Real, covered by tests |
| Webhooks (call ended, inbound mail, assistant tools) | Real, fail-closed when the shared secret is unset |
| Daily re-check withdrawing an aged closure | Real, covered by tests |
| Page reads started from the board | Real: read on the server, timed, filed against the case |
| Vendor integrations | 9 of 10 keyed and exercised on the deployment; the two exceptions are the rows below |
| OpenAI-backed extraction | Keyed, but the provider answers `402 insufficient_quota`. The pipeline prefers the call platform's own reading of a call, so a graded run does not need this key at all |
| Inkeep knowledge | Off. The account has no organization, so the health endpoint reports it false |
| Assistant refusing to state an unread number | Mechanism in place — the tool is the only route to a value. Not yet exercised on a live call |
| Dialling out from the board | Implemented, and refused by the plan rather than by the code: numbers bought from the call platform carry a daily outbound limit, and the board shows that refusal in the provider's own words. Inbound calls to the number answer on this assistant, which is the path the demo uses |
| The chase cadence | Real, covered by tests, and exercised on the deployment: a case was chased with the clock moved past its interval, the message was accepted by the mail provider, the case moved to `CHASING`, and a second run answered "next chase in about 48h". A case whose cadence is exhausted is abandoned with its reason recorded |
| Live deployment | `https://aware-jellyfish-285.convex.site` — the landing, the board, health, `/cases` and `/case` all answer |
| Demo video | Not recorded |

Nothing above claims to be proven that has not been run.

## Licence

MIT.
