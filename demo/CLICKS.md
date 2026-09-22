# The demo, for recording: what to click, what to say

Site: `https://aware-jellyfish-285.convex.site` — browser full screen, no terminal tab, no GitHub tab.

Before you start:
- set the passphrase you will type on camera first, so it is short and you know it: `./scripts/set-operator-passphrase.sh` (it is also readable in `/home/arch/bailiff/.env.local`)
- have one file ready to upload (any PDF or text file — a bill, a statement)
- open **two tabs** on the site, both on the board, signed in on both. The second tab exists to show a case arriving in the first (step 6).

---

**1.** Land on the page. Don't click yet.
**SAY:** This is bailiff. A case against a company that owes you stays open until their own record shows the outcome.

**2.** CLICK the nav item **02 What is verified**.
**SAY:** It says what it can't verify, on the front page, next to what it can.

**3.** CLICK **Open the board** (top right).
**SAY:** The reads are public — health, the self-test, every case as JSON. The actions are not. This is the operator's screen, so it asks for a passphrase.

**4.** Type the passphrase in the field, CLICK **Sign in**.
**SAY:** One passphrase, and the deployment keeps only hashes of the sessions it hands out.

**5.** SCROLL to the line that begins **"Showing all … cases, newest first"**, and the line just below it beginning **"This list is a live subscription…"**.
**SAY:** Every case the pipeline has touched, with the counts taken from the same rows the list renders.

**6.** SWITCH to the second tab, already signed in and on the board. CLICK **Open a case** in the left sidebar. Type a reference and a company name, CLICK **Open the case**, then CLICK **Freeze the set**. SWITCH BACK to the first tab.
**SAY:** The requirement set is hashed before anyone is contacted. And this list is a subscription, not a page — that case is already showing here, in a tab I never reloaded.

**7.** CLICK the row for **Meridian Broadband** (right side reads **GBP 128.40**).
**SAY:** This one closed, and it closed on the other side's own reply.

**8.** SCROLL to **Requirements**, then **Evidence**.
**SAY:** Every requirement points at the evidence that satisfied it: when it was read, and the hash of exactly what came back.

**9.** SCROLL to **Claims and grade**.
**SAY:** The grade prints its checks, and only a passing grade releases the charge.

**10.** CLICK **Case board** in the left sidebar, then the row for **Bramble Energy** (right side reads **GBP 96.50**).
**SAY:** This one can't close yet. Its requirement is still outstanding.

**11.** CLICK **Try to close it**. Let the answer sit on screen for two seconds.
**SAY:** Ask it to close anyway, and it refuses, naming the requirement that has nothing behind it.

**12.** SCROLL to **What an operator can start**. Leave the URL as it is, CLICK **Read it**.
**SAY:** A page is read on the server, timed, and filed against this case. The browser never asserts what a page said.

**13.** Under **Upload the owner's document**, choose your file, then CLICK **File it**.
**SAY:** A document is a file, not a paragraph someone retyped. It is hashed as it arrives, and offered back.

**14.** CLICK **Integrations** in the left sidebar.
**SAY:** And the deployment reports itself: what carries a key, and what does not.

**15.** In the address bar, go to `https://aware-jellyfish-285.convex.site/selftest`.
**SAY:** One request asks the deployment what it can do. It writes four bytes to storage, reads them back, and reports anything it could not check as skipped rather than passing.

**16.** Nothing to click. Hold on the JSON for a beat.
**SAY:** Nine of ten integrations on. The one that is not says so itself, in its own output.

---

About two and a half minutes at a normal pace, and nothing above needs a terminal.

Two buttons are dead clicks on this deployment, both tested: **Grade it** does nothing visible on a case with no ingested call, and **Dial** is refused by the phone platform's own outbound limit.

The passphrase appears in the recording, so change it once with the same script afterwards — on camera, a passphrase is a published passphrase.
