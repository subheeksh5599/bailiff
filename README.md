<div align="center">

# Bailiff

### A case against a company that owes you stays open until their own record proves the outcome.

[![Live](https://img.shields.io/badge/live-aware--jellyfish--285.convex.site-2ecc71)](https://aware-jellyfish-285.convex.site)
[![Tests](https://img.shields.io/badge/tests-132%20passing-2ecc71)](tests)
[![Convex](https://img.shields.io/badge/backend-Convex-ee342f)](https://convex.dev)
[![Sponsors](https://img.shields.io/badge/stack-OpenAI%20·%20Firecrawl%20·%20AgentMail-14151a)](#how-it-uses-each-sponsor)
[![Demo](https://img.shields.io/badge/demo-watch%20it-red)](https://youtu.be/nlCXhzFYia4)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

Bailiff is what you use when a company owes you money and the answer is always *"we're looking into it"*. You open a case, and the facts that have to be true for it to be over are **frozen and hashed before anyone is contacted** — they cannot be rewritten afterwards, by you or by them. Every read is fetched on the server, stored with **the time it happened and a hash of what came back**, and a promise is only ever checked against **our own recording** of the call. A claim about what *they* did needs *their* record: their reply, their page, their document. When the requirement is satisfied the case closes `VERIFIED` pointing at the evidence that closed it — and **the charge is released only by a passing grade, which prints every check it made**. Ask it to close early and it refuses, naming the requirement that has nothing behind it.

### ▶ Live on the deployment — every claim below is one click or one curl away

**[ Open the board ↗ ](https://aware-jellyfish-285.convex.site/dashboard)** · **[ Check it yourself ↓ ](#-check-it-yourself)** · **[ How a case moves ↓ ](#how-a-case-moves)** · **[ Honesty table ↓ ](#whats-real-and-what-is-not)** · **[ Watch the demo ↗ ](https://youtu.be/nlCXhzFYia4)**

Built for the **Convex All Gas Hackathon** · *Convex · OpenAI · Firecrawl · AgentMail*. MIT licensed.

</div>

## The 20-second pitch

Chasing money owed to you is a correspondence problem with no memory. You send a message, someone half-answers, the thread dies, and three weeks later you cannot remember what was even promised — let alone prove it. Nobody closes anything; things just stop being mentioned.

**Bailiff is a case file with a gate on it.** A case opens with a frozen, hashed list of what has to be true. Evidence is fetched server-side and carries the time it was read and a hash of what came back. A promise made on a call is graded against the transcript we recorded ourselves. A claim about the other side needs the other side's own material. Nothing closes because a party said so, and nothing is billed because someone felt done.

```
You open a case
      |
      v
requirements frozen + hashed  ──►  cannot be rewritten, by either side
      |
      v
reads: the server fetches, times, and hashes what came back
      |
      +--X close requested early --> REFUSED, naming the requirement with nothing behind it
      |                              (and it chases what is outstanding, then gives up honestly)
      |
      v
grade: every check printed, verdict pass or fail
      |
      +--X fail --> no charge is written, the case stays open
      |
      v
release: charge written exactly once, by the passing grade
      |
      v
VERIFIED, pointing at the evidence that closed it
```

The gate is the product: **freeze → read → grade → release**, and a refusal is a first-class outcome at every step.

---

## Table of contents

- [See it in one command](#-see-it-in-one-command)
- [The problem it solves](#the-problem-it-solves)
- [How a case moves](#how-a-case-moves)
  - [1 · Freeze](#1--freeze)
  - [2 · Read](#2--read)
  - [3 · Grade](#3--grade)
  - [4 · Release](#4--release)
  - [5 · Chase, then give up honestly](#5--chase-then-give-up-honestly)
- [Architecture](#architecture)
  - [The states a case moves through](#the-states-a-case-moves-through)
  - [Component by component](#component-by-component)
  - [The HTTP surface](#the-http-surface)
- [How it uses each sponsor](#how-it-uses-each-sponsor)
- [Files, not paragraphs](#files-not-paragraphs)
- [The phone line](#the-phone-line)
- [What's real and what is not](#whats-real-and-what-is-not)
- [Tests](#tests)
- [Run it locally](#run-it-locally)
- [Configuration](#configuration)
- [Deploy](#deploy)
- [Project layout](#project-layout)
- [Tech stack](#tech-stack)
- [Demo](#demo)
- [Licence](#licence)

---

## ▶ See it in one command

No auth, nothing that can change anything — three reads against the live deployment:

```bash
# what the deployment can do, checking itself: it writes four bytes to storage,
# reads them back, deletes them, and reports what it could not run as skipped
curl -s https://aware-jellyfish-285.convex.site/selftest | python3 -m json.tool

# every case, as JSON: the same rows the board renders
curl -s https://aware-jellyfish-285.convex.site/cases | python3 -m json.tool | head -40

# one case end to end: the requirements, the evidence with hashes, the grade
# with its checks, the charge, and a `proof` block that is small enough to diff
curl -s "https://aware-jellyfish-285.convex.site/case?ref=case-2026-0914-0188" | python3 -m json.tool
```

Then open [the board](https://aware-jellyfish-285.convex.site/dashboard) and click any case: the screen shows what the JSON says, and the JSON is one link from the screen (`this record as JSON →`).

---

## The problem it solves

Unexplained-message disputes are one-sided by construction. You can prove what *you* sent. You cannot prove what they never said — and the arithmetic of "did the refund actually move" lives entirely in their systems.

Software usually answers this by giving you a nicer inbox. Bailiff answers it by making closure a question with a checkable answer:

- **A requirement set that cannot move.** Frozen at intake and hashed, so a case cannot be quietly reshaped to fit whatever eventually turned up.
- **Evidence that carries its own receipts.** When it was read, where from, and a hash of exactly what came back.
- **Authority rules rather than trust.** A promise made on a call is graded against our own transcript; a claim about the other side needs the other side's material, filed through the ingest path, never typed in as fact.
- **A billing gate.** The charge is released by a passing grade and nothing else. A failing grade writes no charge and says which check failed.

---

## How a case moves

### 1 · Freeze

A case opens with a reference, a company, what is owed, and the facts that must be true for it to be over. The requirement set is hashed at intake. The browser cannot rewrite it; the only thing a client can add is the owner's own documents.

### 2 · Read

Anything read is fetched **on the server**, timed, and filed against the case — a counterparty's page, an inbound email, a call transcript, or the owner's uploaded file. The browser never asserts what a page said, because a browser can be told what to say.

### 3 · Grade

A call's transcript is hashed, its claims are extracted, and each claim is judged by where it stands: a promise is checked against our own recording, a claim about the counterparty needs their record. The grade prints its checks. `pass` or `fail`, with the failing check named.

### 4 · Release

A `pass` writes the charge **exactly once**, keyed on the call reference, so a retry cannot bill twice. A `fail` writes nothing. Either way, the outcome is on the case and in the audit trail.

### 5 · Chase, then give up honestly

A case that is frozen but unread chases what is outstanding on a cadence, and after the last attempt it is abandoned **with the reason and the list of what never came back** — rather than sitting open forever pretending to be in progress.

---

## Architecture

Convex is the whole backend: the case ledger, the workflow, the scheduled sweeps, the HTTP hooks, and file storage. There is no server of ours to deploy and no queue to babysit.

### The states a case moves through

```
OPEN ──► FROZEN ──► CHASING ──► VERIFIED
  │         │           │
  │         │           └──► ABANDONED (reason + what never came back)
  │         └──► DISPUTED (reopened: a closure can be withdrawn when it ages out)
  └──► REFUSED (a close attempt that could not be justified)
```

Every transition is written by the same code that checks the rule, and every one leaves a line in the case's audit trail.

### Component by component

| Piece | What it does |
|---|---|
| `convex/cases.ts` | Opens a case, freezes and hashes its requirements, closes it — only through the verifier |
| `convex/verify.ts` | Re-reads the requirement and evidence rows every time it is asked. Refusals name the requirement and the reason |
| `convex/orchestrator.ts` | The pipeline: read, extract, grade, meter, report — each step writing what it did |
| `convex/grade.ts` | Judges claims, prints its checks, and is the only thing that can release a charge |
| `convex/attachments.ts` | Uploads to Convex storage, hashed from the bytes that arrived, matched by the same rule the gate uses |
| `convex/chase.ts` | The cadence that asks what is outstanding, sends, and eventually abandons with a reason |
| `convex/insights.ts` | Outcomes rather than counts: time to closure, why closures are refused, who keeps coming back |
| `convex/selftest.ts` | The deployment checking itself, including writing and reading storage back |
| `convex/http/*.ts` | The HTTP surface: reads anyone may make, hooks that run only with a shared secret |
| `convex/integrations/*` | One module per vendor, each with a stubbed-transport test and a live probe |

### The HTTP surface

| Route | Method | Who may call it |
|---|---|---|
| `/health` | GET | anyone — which integrations carry a key |
| `/selftest` | GET | anyone — the deployment checking itself |
| `/cases`, `/case?ref=` | GET | anyone — the same rows the board renders, plus a `proof` block |
| `/dashboard` | GET | anyone — the board, served from static hosting |
| `/hooks/call-ended` | POST | the call platform only, with a shared secret |
| `/hooks/inbound-email`, `/hooks/agentmail` | POST | the mail provider only, with a shared secret |
| `/hooks/vapi-tools` | POST | the voice assistant's tools only, with a shared secret |

The hooks are **fail-closed**: without the shared secret they refuse, which is why a forged "call ended" cannot close a case or move money.

---

## How it uses each sponsor

| Sponsor | What it actually does here |
|---|---|
| **Convex** | The ledger, the workflow, the crons, the HTTP hooks, the storage, and the reactive board. Every vendor call is a Convex action or component call, so it lands in the same transaction log as the thing it justifies |
| **Firecrawl** | Reads the counterparty's own pages. Verified live: a real page fetched and its text stored with the time and a hash |
| **AgentMail** | The case's mailbox. It sends the report and receives the reply, and the reply becomes evidence with its own hash |
| **OpenAI** | Turns a transcript into claims. Wired and keyed; the provider currently answers `402` until credit lands, and the case records that refusal as `extraction.failed` rather than hiding it. The pipeline prefers the call platform's own analysis of the call, so it decides money without any model key |

---

## Files, not paragraphs

A statement is a PDF or a photo of a screen, not something retyped into a box. Uploads go to Convex storage, are **hashed from the bytes that arrived**, are filed as the owner's own record, and are offered back as a download. A type or size the rule does not accept is refused with the reason, and a refused upload is deleted rather than left costing storage.

An owner's document never satisfies a requirement that asks for the other side's material — the same rule the close gate applies, applied at the upload.

---

## The phone line

The case has a number, and the assistant behind it can do two things: read a source back to the caller, and file a promise. The assistant is instructed never to state a number it has not read, and the case line's own end-of-call analysis is what the pipeline extracts claims from.

What it will not do: dial out. The phone platform refuses outbound calls on this plan **with its own sentence**, and the board shows that sentence verbatim rather than pretending the call happened. Inbound works, and everything about a call is stored as it arrives.

---

## What's real and what is not

| Thing | State |
|---|---|
| Case state machine, verifier, requirement freezing and hashing | Real, covered by tests |
| Claim verdicts, evidence freshness and authority rules | Real, covered by tests |
| Billing gate, exactly-once charge | Real, covered by tests |
| The chase cadence, and abandoning with a reason | Real, verified live |
| Webhooks | Real, fail-closed without the shared secret |
| File uploads | Real: uploaded, hashed from the bytes, readable again |
| Firecrawl, AgentMail, the call platform, metering, tracing | Keyed and exercised live |
| OpenAI extraction | Keyed, provider answers `402`. Does not block the pipeline: claims come from the call platform's own reading of the call |
| Inkeep | Off: that account belongs to no organization, so it cannot be exercised. `/health` reports it as `false` |
| Dialling out from anywhere | Refused by the phone platform's own daily limit on purchased numbers. Inbound works |
| The assistant never stating an unread number | Mechanism in place, not yet exercised on a live call |
| The board, health, self-test, and both JSON routes | Live, and every row above was run against them |

No screen in this project renders a value that did not come from a real read.

---

## Tests

```bash
npm install && npm test        # 132 tests across 13 files, no vendor keys needed
```

Each integration has a stubbed-transport test *and* a live probe, so the code is covered without pretending a vendor was reached. The rules that decide money — evidence freshness, authority, the grade, the exactly-once charge — are tested per rule rather than per file.

---

## Run it locally

```bash
git clone https://github.com/subheeksh5599/bailiff && cd bailiff
npm install && npm test          # the rules, no keys required
npx convex dev                   # the backend, against your own deployment
cd frontend && npm install && npm run dev
```

`frontend/.env.local` wants one line — `NEXT_PUBLIC_CONVEX_URL` — or the build **refuses to run** and tells you why. A panel built without it would export fine and then open with nothing behind it, which is worse than a build that stops. There is no sample data anywhere in this repository: the board reads a real deployment and shows nothing if it has none.

---

## Configuration

Names only; every value lives in `.env.local` (git-ignored, mode 600).

```
CONVEX_DEPLOY_KEY   the deployment's own key
OPENAI_API_KEY      extraction (402 until credit lands)
FIRECRAWL_API_KEY   reads the counterparty's pages
AGENTMAIL_API_KEY   the case's mailbox
VAPI_*              the case line: key, assistant, number, webhook secret
AUTUMN_*            metering on a passing grade
SCORECARD_*         tracing
```

`/health` reports which of these are present, and `/selftest` says what it could and could not check.

---

## Deploy

```bash
export CONVEX_DEPLOY_KEY=...     # the deployment's key
./scripts/deploy.sh              # functions + deployment variables, then health
cd frontend && npm run build && npx @convex-dev/static-hosting upload -d out
```

No value is ever passed on a command line: variables are pushed with `env set --from-file`, so nothing secret reaches a log or a process list.

---

## Project layout

```
convex/            the case, the pipeline, the gates, the adapters, the routes
frontend/          the site: the landing page and the board (static export to convex.site)
demo/              the video, the stills it was cut from, the click sheet, the narration
tests/             132 tests across 13 files
docs/              integrations, deployments, the demo, what a live run printed
scripts/           deploy, the live end-to-end run, the video assembly
hackathon.md       the build log, including what a live deployment found
```

---

## Tech stack

**Backend** Convex (database, functions, crons, HTTP actions, file storage, static hosting) · **Frontend** Next.js App Router, static export · **Types** TypeScript end to end, generated from the schema · **Tests** Vitest · **Sponsors** OpenAI, Firecrawl, AgentMail · **Also wired** the call platform, metering, tracing.

---

## Demo

**[The explainer ↗](https://youtu.be/nlCXhzFYia4)** — 100 seconds. The open and the close are rendered motion pieces; everything between them is the live deployment.

**[The click-through](demo/bailiff-clickthrough.mp4)** — 61 seconds, twelve real interactions with a caption on each. And the demo written as clicks and lines, for recording it by hand: [`demo/CLICKS.md`](demo/CLICKS.md).

**[The motion piece alone](demo/hyperframes-narrated.mp4)** — 35 seconds with narration, for posting.

---

## Licence

MIT — see [LICENSE](LICENSE).
