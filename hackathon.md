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
- **Live app:** not deployed yet — deployment created, functions to be pushed on the
  first run of `./scripts/deploy.sh`.
- **Demo video:** not recorded yet; the beat sheet is in `docs/DEMO.md`.
- **Repo:** this repository, public.

## What is real right now, and what is not

| Piece | State |
|---|---|
| Case state machine, verifier, requirement freezing and hashing | Real, covered by tests |
| Claim verdicts, evidence freshness and authority rules | Real, covered by tests |
| Billing gate, exactly-once charge, retry of a failed delivery | Real, covered by tests |
| Webhooks (call ended, inbound mail, assistant tools) | Real, fail-closed without the shared secret |
| Daily re-check withdrawing an aged closure | Real, covered by tests |
| Firecrawl reads | Keyed and reachable (verified against the vendor) |
| AgentMail send + inbound reply | Code complete and unit-tested on our side; **key not yet set** |
| Extraction (OpenAI) | Keyed and reachable; the provider answers `402 insufficient quota` until credits land on the 24th, and that refusal is recorded on the case as `extraction.failed` |
| Metering (Autumn) | Keyed and reachable (verified) |
| Telephony (Vapi) | Keyed, assistant exists, **no phone number on the account yet** |
| Live URL | Not deployed |

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
npm test             # 98 tests, no vendor keys needed
npm run typecheck
npx convex dev       # backend
cd web && npm install && npm run dev   # landing + case board
./scripts/deploy.sh  # push functions and deployment variables (needs CONVEX_DEPLOY_KEY)
```

## Where to look

- `README.md` — the claim, the invariants, and the honesty table.
- `docs/INTEGRATIONS.md` — what each integration does and what happens when its key is missing.
- `docs/DEMO.md` — the demo beat sheet. `docs/RUNOFSHOW.md` — the live session plan.
- `convex/lib/rules.ts` — the freshness, authority and grade rules, as pure functions.
- `convex/verifier.ts` — the only path to a closed case.
- `convex/billing.ts` — the gate, in one mutation, with the idempotency key.
- `tests/` — 98 tests; the ones that matter defend the three invariants above.
