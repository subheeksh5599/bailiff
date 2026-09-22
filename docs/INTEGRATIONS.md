# Integrations

Each integration is a small adapter with a single job, and each one is off until
its key exists. This page says what it does, what it needs, and what happens when
it is missing.

| # | Integration | Does | Needs | When unset |
|---|---|---|---|---|
| 1 | Convex | the ledger: cases, requirements, evidence, claims, calls, grades, billing, audit | `npx convex dev` | nothing works; the board says it is not connected |
| 2 | Crawler | reads the counterparty's own page and stores it as evidence with the time it was read | `FIRECRAWL_API_KEY` | `read_source` returns an error to the call and the assistant is instructed to say it cannot confirm; nothing is stored |
| 3 | Extraction | turns a transcript into claims (promises, facts, what the caller wanted, whether it resolved) | `OPENAI_API_KEY` | the pipeline stops at that step and writes `pipeline.stopped` naming the variable |
| 4 | Grading | the graded run is handed to an outside evaluator as a trace: one span carrying the case, the call, the claims and the evidence behind them. What comes back is an acknowledgement, not a score, so no score is claimed | `SCORECARD_API_KEY` | skipped, and any failure is recorded as `grade.independent_failed`; the gate still uses our own checks |
| 5 | Metering | charges one unit for a passing call | `AUTUMN_SECRET_KEY` | a passing call is recorded as billable-but-unmetered, which is visible in the audit trail |
| 6 | Email | sends the written record to the owner, built only from rows already on the case | `RESEND_API_KEY`, `RESEND_FROM`, `OWNER_EMAIL` | skipped, with the missing variable named |
| 7 | Knowledge | grounds the spoken answers in the business's own material | `INKEEP_API_KEY` | the grounded-answer path refuses instead of improvising |
| 8 | Telephony | places the call and delivers the assistant's tool calls to our hooks | `VAPI_API_KEY`, `VAPI_WEBHOOK_SECRET` | no outbound call is placed; the tool hooks refuse unsigned deliveries |
| 9 | Auth | ownership of the console | planned; the board currently runs as a single owner | not enforced yet |

## The two hooks

- `POST /hooks/call-ended` — the finished call's transcript, stored verbatim and
  hashed, filed against a case by reference. A payload with no transcript is
  rejected, not filled in.
- `POST /hooks/vapi-tools` — `read_source` and `file_promise`. This is the
  mechanism behind "never state a number you have not read": the only route to a
  value runs through here, and every read is written onto the case before the
  value is spoken.
- `GET /health` — which integrations are on. Booleans only.

## Endpoint assumptions

Vendor paths live in `convex/integrations/endpoints.ts`, each with the source it
came from. They are pinned from published packages and documentation indexes, and
each is overridable by environment variable. When a key is first set, the first
call each adapter makes should be checked against the vendor's own reference — the
notes in that file say which endpoint to confirm and what it was based on.

## Verified on the live deployment

Each of these was run against the deployed backend, not a local one:

| Integration | What was actually observed |
|---|---|
| Crawl | a public page was fetched and its text returned, with the fetch time attached |
| Mail | a message was sent and the provider acknowledged it with a message id |
| Meter | a metered event was accepted for the resolution feature |
| Grading | a graded run was delivered; the evaluator acknowledged it (`delivered: true`) |
| Telephony | assistant exists with the two tools and the deployment as its server URL |
| Extraction | keyed and reachable; the provider returns `402 insufficient_quota` until credit is added |

Two resources live outside the repository, because both platforms own them: the
resolution feature the meter counts against, and the customer it is counted for.
Both were created against the live accounts, and the code reads them by id.
