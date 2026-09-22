/**
 * Landing page copy.
 *
 * Rule for everything in this file: no claim that is not already true and
 * checkable. The deployment, the endpoints and the limitations are stated in
 * the same voice as the features, and the verification commands are the ones
 * that were run against the live deployment.
 */

export const siteConfig = {
  name: "Bailiff",
  tagline: "A case closes when the outcome is verified",
  description:
    "Requirements frozen at intake, evidence read back after the case opened, and a charge released only by a grade that passes. The pipeline writes down what it could not confirm instead of guessing.",
  url: "https://aware-jellyfish-285.convex.site",
  cloud: "https://aware-jellyfish-285.convex.cloud",
  repo: "https://github.com/subheeksh5599/bailiff",
  twitter: "@subheeksh5599",
  nav: {
    cta: { text: "Open the board", href: "/dashboard.html" },
  },
};

export const heroConfig = {
  /* Two lines. A display line that wraps to three or four is a staircase, not
     a composition. */
  headline: ["A case closes when", "the outcome is verified"],
  subheadline:
    "Requirements are frozen the moment a case opens, before anyone knows how the call will go. They can only be satisfied by a record read back afterwards, and the charge is released only by a grade that passes.",
  primary: { text: "Open the board", href: "/dashboard.html" },
  secondary: { text: "Verify it yourself", href: "#verify" },
};

export const techStackConfig = {
  /* "Built on", never "used by" — these are dependencies, not customers. */
  title: "Built on",
  items: [
    { name: "Convex", description: "The case, the evidence and the audit trail" },
    { name: "Vapi", description: "The phone line a case is opened on" },
    { name: "Firecrawl", description: "Fetching a page as evidence" },
    { name: "AgentMail", description: "The mailbox a case writes to and reads from" },
    { name: "OpenAI", description: "Reading a call into claims" },
    { name: "Scorecard", description: "An outside evaluator for the same run" },
    { name: "Autumn", description: "Metering a released charge" },
  ],
};

/** One row of a ledger: field, value, and what it gives away. */
export type LedgerRow = readonly [field: string, value: string, note: string];

/** The problem, shown rather than asserted. Both columns are real case shapes. */
export const leakConfig: {
  statement: string;
  body: string;
  plain: { label: string; caption: string; rows: LedgerRow[] };
  sealed: { label: string; caption: string; rows: LedgerRow[] };
} = {
  /* Two lines at display size. A headline that wraps to four is a staircase
     of short rows, not a composition. */
  statement: "A closure is worth exactly what it rests on.",
  body: "Most disputes end the same way: someone says the money moved, someone writes it down, and the case is closed. Nothing is read back, so nothing can be checked later, and the note that closed it is worth as much as the person who wrote it. The other route is worse — waiting indefinitely for a record that never arrives, while whoever is owed carries the cost of the delay.",
  plain: {
    label: "How it usually closes",
    caption: "A sentence on a call, and a note nobody can check.",
    rows: [
      ["claim", "\u201calready refunded\u201d", "said on the call"],
      ["record", "none", "nothing read back"],
      ["state", "closed", "and the charge released"],
      ["proof", "a note", "unfalsifiable afterwards"],
    ],
  },
  sealed: {
    label: "The same case here",
    caption: "One requirement, one read-back, and the pointer kept.",
    rows: [
      ["requirement", "frozen at intake", "hashed before the call"],
      ["evidence", "mail:their reply", "read after the case opened"],
      ["grade", "pass", "every check printed"],
      ["charge", "released", "by the grade, and nothing else"],
    ],
  },
};

/**
 * Source: README, "What is verified, and what is not". Being precise about this
 * matters more than the feature list, so it is reproduced rather than softened.
 */
export const disclosureConfig = {
  title: "What is verified, and what is not",
  lede: "Being precise about this matters more than any feature list.",
  sealed: {
    label: "Verified",
    note: "Read back after the case opened, hashed, and attached to the case.",
    items: [
      "The words of the call, as our own recording of it",
      "A commitment the caller was given, checked against that recording",
      "A page of theirs, fetched and stored with the time it was read",
      "A reply they sent, filed to the case by the mailbox",
      "Which requirement was satisfied, and by which piece of evidence",
    ],
  },
  open: {
    label: "Not verified",
    note: "Cannot close a case on its own, however confidently it was stated.",
    items: [
      "Anything said on the call about what the other side has already done",
      "A claim the caller reports second-hand",
      "A figure with no readable date on it",
      "A transcript that arrived after the case had already closed",
      "Any statement whose only source is the party that benefits from it",
    ],
  },
  limitation: {
    label: "Known limitation, stated plainly",
    code: "A recording of us talking",
    body: "A recording of us talking proves what was promised and nothing more. When a case turns on what the other side actually did, it stays open until one of their own records is read back, and the pipeline writes the outstanding requirement onto the case rather than guessing at an answer.",
  },
};

/** The four movements of a case. Deliberately not a numbered list on a rail. */
export const pathConfig = {
  title: "How a case moves",
  lede: "Nothing here is decided by the party that benefits from the closure.",
  steps: [
    {
      key: "freeze",
      title: "Freeze",
      body: "The case opens and its requirements are frozen with a hash before any call is placed. They cannot be rewritten afterwards, by us or by anyone else.",
      detail: "requirementSetHash = sha256(set)",
    },
    {
      key: "read",
      title: "Read",
      body: "The call ends, the transcript is filed as our own record, and the mailbox keeps whatever the other side sends. Every read carries the time it happened.",
      detail: "fetchedAt \u2265 openedAt",
    },
    {
      key: "grade",
      title: "Grade",
      body: "Each claim is put against the evidence that could support it. A promise is checked against our own recording; a statement about their behaviour is not, and stays unverified until their record arrives.",
      detail: "promises_on_record \u00b7 unverified",
    },
    {
      key: "release",
      title: "Release",
      body: "Only a passing grade writes a billing row, keyed on the call reference, so a replayed call re-reads one row instead of charging twice. An unreachable meter leaves the row pending, never quietly free.",
      detail: "call:\u2026 \u2192 one row",
    },
  ],
};

/** Real commands against the live deployment, with their real response shapes. */
export const verifyConfig = {
  title: "Verify it yourself",
  lede: "Every claim on this page is checkable from a terminal right now. Nothing here is a mock.",
  checks: [
    {
      label: "The deployment is up, and says which integrations carry a key",
      command: "curl -s $SITE/health",
      output: `{ "ok": true, "integrations": {
  "convex": true, "firecrawl": true, "extraction": true,
  "grading": true, "metering": true, "email": true,
  "mailReceives": true, "telephony": true, "hooks": true,
  "knowledge": false } }`,
    },
    {
      label: "The board reads the same cases the pipeline wrote",
      command: "curl -s $SITE/cases",
      output: `[ { "ref": "live-close-134804", "state": "VERIFIED",
    "counterparty": "Northwind Utilities",
    "currency": "GBP", "amountClaimedUnits": 4120 },
  { "ref": "live-refuse-134804",
    "state": "REQUIREMENTS_FROZEN", \u2026 } ]`,
    },
    {
      label: "A closed case names the evidence that closed it",
      command: 'curl -s "$SITE/case?ref=live-close-134804"',
      output: `{ "case": { "state": "VERIFIED", "verifiedAt": \u2026 },
  "requirements": [ { "key": "their_reply",
    "satisfied": true,
    "satisfiedByEvidenceId": "js7fhngx\u2026" } ],
  "evidence": [ { "kind": "email_reply",
    "sourceKind": "counterparty", \u2026 } ] }`,
    },
  ],
  footnote:
    "knowledge is false because that account has no organization to attach it to, and it is reported rather than hidden. Claims are read from the call platform's own analysis of the call, so extraction does not depend on a model key being present.",
};

export const footerConfig = {
  columns: [
    {
      heading: "Product",
      links: [
        { label: "Case board", href: "/dashboard.html" },
        { label: "Open a case", href: "/dashboard.html?view=new" },
        { label: "Integrations", href: "/dashboard.html?view=integrations" },
      ],
    },
    {
      heading: "Build",
      links: [
        { label: "README", href: "https://github.com/subheeksh5599/bailiff#readme" },
        {
          label: "Build log",
          href: "https://github.com/subheeksh5599/bailiff/blob/master/hackathon.md",
        },
        {
          label: "Integrations note",
          href: "https://github.com/subheeksh5599/bailiff/blob/master/docs/INTEGRATIONS.md",
        },
      ],
    },
    {
      heading: "Source",
      links: [
        { label: "GitHub", href: "https://github.com/subheeksh5599/bailiff" },
        {
          label: "Deployments",
          href: "https://github.com/subheeksh5599/bailiff/blob/master/docs/DEPLOYMENTS.md",
        },
        { label: "MIT licence", href: "https://github.com/subheeksh5599/bailiff/blob/master/LICENSE" },
      ],
    },
  ],
  colophon: `Convex \u00b7 Vapi \u00b7 Firecrawl \u00b7 AgentMail \u00b7 OpenAI \u00b7 Scorecard \u00b7 Autumn \u00b7 MIT \u00b7 ${new Date().getFullYear()}`,
};

export const features = {
  smoothScroll: true,
};
