# Demo video — beat sheet

Four minutes, recorded on the live deployment, one take per section. Every number
on screen comes from the board reading the deployment; nothing is typed in, and no
frame is a fixture. Say each number as it appears — the whole point of this product
is that the screen and the claim agree.

Total: ~4:00. Narrate to camera, not to the terminal.

---

## 0:00 – 0:25 · The problem

**On screen:** the landing page at `/`.

> "Getting money back from a company is email work, and it has no end condition.
> A ticket gets marked resolved without the refund existing. Someone says 'it was
> issued on the 20th' and the person waiting has no way to tell a promise from a
> record. So the chase continues until somebody gives up.
>
> The problem isn't that the message is hard to write. It's that 'done' is a claim
> with nothing behind it."

---

## 0:25 – 1:15 · A case, and a requirement set that cannot move

**On screen:** `/board`. Open a case: reference `case-demo-01`, company, amount.
Press **Open the case**.

> "A case opens with the things that must be true for it to be over, and they are
> frozen at intake and hashed. Not a ticket status — a set of facts that have to
> exist, each one needing evidence of its own kind, read after this case opened."

Point at the requirement list: both rows open, set hash visible.

> "That hash is the reason the goalposts can't move later."

---

## 1:15 – 2:00 · Try to close it. Watch it refuse.

**On screen:** paste the customer's own thread, press **Store it as our own
record**, then press **Ask to close the case**.

> "Here's the customer's own email thread. It's real evidence, and it satisfies
> something — but not the requirement about their record. So watch what happens
> when I ask it to close."

The refusal appears, naming the requirement and the reason.

> "It refuses, and it says which requirement is still open and why. That refusal
> is written into the case's diary — it isn't a toast that disappears."

---

## 2:00 – 2:45 · Where a number is allowed to come from

**On screen:** the integration pills at the top, then a call.

> "On a call, the assistant has exactly two tools, and one of them is the only way
> any price, date or status can be spoken: `read_source`. That tool reads the
> company's own page right then and stores it on the case with the time it was
> read. When the read fails, the assistant is instructed to say it cannot confirm —
> and because the read never landed, there is nothing on the case for that promise
> to hide behind."

---

## 2:45 – 3:30 · Money only behind a passing grade

**On screen:** the grades and billing section for the case.

> "The call is transcribed, the transcript is hashed, and the claims are read out
> of it: what the caller wanted, what was promised, what was presented as fact.
>
> The facts are the interesting part. A promise can be checked against our own
> recording — the transcript proves it was said. A statement about the world can't
> be. So a fact with no record behind it is marked unverifiable, and unverifiable
> bills nothing."

Point at the checks, then at the billing row.

> "Only a pass releases a charge, the charge is written in the same transaction as
> the grade, and the key is the call's own reference — so a replayed webhook reads
> the same row instead of billing twice."

---

## 3:30 – 4:00 · The closure can come back

**On screen:** the diary, then the re-check.

> "Last thing, and it's the part I'd want to know if I were buying this. Every day
> a re-check walks the closed cases. If the evidence that closed one has aged out,
> the closure is withdrawn, the case goes back to dispute, and the reason is
> written down. A 'done' that can't come undone isn't a fact, it's a claim."

> "Bailiff keeps a case open until the other side's own record shows the outcome.
> Everything you saw on screen was read from the deployment."

---

## Recording notes

- One take per section; stitch them.
- Show the deployment URL in the browser chrome, or the board's own header.
- If a vendor is switched off, say so and show the pill. That is the honest state,
  and it is more convincing than a demo that hides it.
- Never type a value into the UI that is not a real input: the reference, the
  company name and the pasted thread are inputs; everything else is read back.
