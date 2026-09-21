# Run of show — the live session

Ten minutes with a judge. Lead with the refusal, escalate to the gate, close on
the re-check. Everything on screen is the live deployment.

## Pre-flight (do this before you are on)

- [ ] `npx convex dev` running against the deployment the URL points at.
- [ ] `cd web && npm run dev` (or the deployed URL) open at `/board`.
- [ ] `curl <deployment>/health` — know exactly which integrations are on, so you
      say the true state before you are asked.
- [ ] One case already open and mid-chase (`case-demo-01`), plus a second you can
      open live.
- [ ] The recorded demo video open in a second tab.
- [ ] The README's honesty table open in a third tab.

## Acts

**0:00 Thesis.** "A case against a company stays open until their own record shows
the outcome. The interesting part is what it refuses to do."

**0:40 Open a case, show the frozen set and its hash.** Say the hash out loud as it
appears. "The requirements can't move after this."

**1:40 Attempt the close with insufficient evidence.** Let the refusal land, read
it, then open the diary and show it recorded. "It named the requirement and the
reason, and it wrote that down."

**2:40 The gate.** Show the graded call: the checks, the unverifiable facts, and
the billing row. "No passing grade, no charge — and the row cannot exist without
the grade in the same transaction."

**3:40 Idempotency.** Replay the same webhook reference and show the row count stay
at one. "Same key, same row."

**5:00 The re-check.** Run it against a case whose evidence has aged out, and show
the closure withdrawn with the reason.

**6:00 Honesty.** Open `/health` and the honesty table in the README, and read out
which integrations are off. "These are off. Here is what that means: the pipeline
stops there and writes down which variable is missing."

## If something breaks

The backup ladder is real artifacts only — never a stand-in:

1. The live URL is unreachable → the recorded demo video (recorded from the same
   deployment).
2. The video is unavailable → the README's proof section and the evidence dumps in
   `docs/evidence/`, which are the actual command output.
3. Everything is down → walk the tests: `npm test` output in `docs/evidence/`, and
   read the invariant each test defends.

## Questions you will get

**"Isn't this just a ticket tracker?"** — A tracker holds a status someone sets. A
case holds a requirement set that cannot be rewritten after intake, and it can only
leave for `VERIFIED` through the verifier, which re-reads the rows. Tickets close
when a human says so; this one can only close when evidence read after the case
opened satisfies every frozen requirement.

**"What stops the agent from lying on a call?"** — Two mechanisms. The only route
to a spoken number is the `read_source` tool, which writes the read onto the case
before the value is spoken; and the transcript is then graded, with statements of
fact that have no record behind them marked unverifiable. Unverifiable bills
nothing — so a lying call is an unpaid call.

**"Why would a company accept a grade it doesn't control?"** — They don't have to
accept our grade: it is printed check by check on the case, and the independent
evaluator's score sits next to it. A dispute is about specific checks, not about
whether the vendor 'likes' the score.

**"What happens when the vendor API is down?"** — The run stops at that step, writes
the missing variable or the vendor's own error into the audit trail, and returns.
A meter that is unreachable leaves the billing row pending, which is visible and
retryable, rather than silently free.

**"Where is the data?"** — Convex. Every table is one argument: what is owed, what
was claimed, what the counterparty said, and whether the two agree.
