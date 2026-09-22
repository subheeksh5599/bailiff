# Bailiff

**A case against a company that owes you stays open until their own record shows the outcome — and nothing on it can be called done because someone said so.**

Status: backend and web are built and green; no vendor key is configured yet, and
the board says so out loud instead of pretending. Nothing in this repository
fabricates a result: `GET /health` on the deployment reports which integrations
are switched on, and every one of them is off until its key is set.

```
tests            82 passing            (npm test)
typecheck        clean                 (npm run typecheck)
web build        / and /board          (cd web && npm run build)
integrations     1 of 9 keyed          (extraction is configured; the provider
                                       currently answers 402 insufficient quota,
                                       so a run stops with that reason on the case)
```

## The problem in one paragraph

Getting money or a correction out of a company is email work, and the work has no
end condition. A ticket can be marked resolved without the refund existing. A
support agent can say "it was issued on the 20th" and be wrong, and the person on
the other end has no way to tell the difference between a promise and a record. So
the chase continues by hand, and the only reason it ever stops is that somebody
gives up.

## What this does

A case is opened with a **frozen requirement set**: the specific things that must
be true for it to be over. Every piece of evidence carries where it came from and
when it was read. Every statement is recorded as a claim with a verdict derived
from that evidence. The case can only reach `VERIFIED` through the verifier, and
the verifier re-reads the requirement and evidence rows every time it is asked —
it does not trust a stored boolean.

Three rules hold the whole thing up, and they are enforced in code, not prose:

1. **A claim is verified only by evidence read after the case opened** — from the
   counterparty's own record or from our own read-back. A third party's page can
   corroborate but can never satisfy a requirement, so a forum post cannot close a
   case about someone else's money.
2. **A case closes only when every frozen requirement is satisfied.** Refusals name
   the requirement and the reason, and the refusal is written to the case's diary.
3. **A closure is not permanent.** A daily re-check re-examines verified cases; when
   the evidence that closed one has aged out, the closure is withdrawn, the case
   returns to dispute and the reason is recorded.

The browser cannot write the evidence that closes its own case: it may attach the
customer's own documents, and nothing else. Anything speaking for the counterparty
arrives only through the ingest path.

## Money

The phone line's worth is decided the same way. A call is transcribed, its claims
are extracted, and it is graded against checks that are printed on the case. Only
a passing grade releases a charge, and the billing row cannot be written without
that grade in the same transaction. The idempotency key is the call's own
reference, so a replayed webhook re-reads the same row instead of charging twice,
and a meter that is unreachable leaves the row pending rather than silently
consuming the call.

## Run it

```bash
npm install                 # convex, vitest, convex-test, typescript
npm test                    # 73 tests, no vendor keys needed
npm run typecheck
npx convex dev              # backend (local deployment; no account needed)
cd web && npm install && npm run dev
```

Copy `.env.example` to `.env.local` (repo root) and set only what you want
switched on. Unset variables are not approximated: the integration reports itself
as off and the pipeline stops at that step with the variable named in the audit
trail.

## The web

- `/` — the landing page.
- `/board` — the case board: open a case, see its frozen requirements, the
  evidence with the time it was read, the claims and their verdicts, the grades
  and the billing rows, the refusal reasons, and the case's own diary.

## Honesty table

| Piece | State |
|---|---|
| Case state machine, verifier, requirement freezing | Real, covered by tests |
| Claim verdicts, evidence freshness and authority rules | Real, covered by tests |
| Billing gate, idempotency, retry of a failed delivery | Real, covered by tests |
| Webhooks (call ended, inbound mail, assistant tools) | Real, fail-closed when the shared secret is unset |
| Daily re-check withdrawing an aged closure | Real, covered by tests |
| Vendor integrations (crawl, extract, grade, meter, mail, knowledge, telephony) | Code complete and unit-tested on the request side. Extraction is keyed and reachable; the provider returns `402 insufficient_quota`, which the pipeline records on the case as `extraction.failed` and leaves ungraded and unbilled. The rest have no key yet |
| Assistant's refusal to state an unread number | Mechanism in place (the tool is the only route to a value); not yet exercised on a live call |
| Live deployment URL | Not deployed; no account, so no public URL exists yet |

Nothing above claims to be proven that has not been run.
