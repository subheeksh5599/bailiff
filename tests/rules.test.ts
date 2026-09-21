import { describe, expect, it } from "vitest";
import {
  canBill,
  claimVerdict,
  evaluateCase,
  gradeVerdict,
  isAuthoritative,
  isFresh,
  requirementMatchedBy,
  type Evidence,
  type GradeCheck,
  type Requirement,
} from "../convex/lib/rules";

const OPENED = 1_700_000_000_000;

function ev(over: Partial<Evidence> = {}): Evidence {
  return {
    _id: "e1",
    kind: "payment_record",
    sourceKind: "counterparty",
    source: "https://example.com/orders/12345",
    fetchedAt: OPENED + 60_000,
    excerpt: "refund issued 41.20 on 2026-09-20",
    ...over,
  };
}

function req(over: Partial<Requirement> = {}): Requirement {
  return { key: "refund_issued", label: "Refund issued", kind: "payment_record", satisfied: false, ...over };
}

describe("freshness: evidence for a case must postdate the case", () => {
  it("accepts evidence read at the moment the case opened", () => {
    expect(isFresh(OPENED, OPENED)).toBe(true);
  });
  it("refuses evidence read one millisecond earlier", () => {
    expect(isFresh(OPENED - 1, OPENED)).toBe(false);
  });
  it("refuses evidence from a previous run of the same dispute", () => {
    expect(isFresh(OPENED - 86_400_000, OPENED)).toBe(false);
  });
});

describe("authority: who is allowed to settle the question", () => {
  it("counts the counterparty's own record and our own read-back", () => {
    expect(isAuthoritative("counterparty")).toBe(true);
    expect(isAuthoritative("own_record")).toBe(true);
  });
  it("does not count a forum post or a model's summary", () => {
    expect(isAuthoritative("third_party")).toBe(false);
    expect(isAuthoritative("model")).toBe(false);
  });
});

describe("requirement matching", () => {
  it("needs the right kind", () => {
    expect(requirementMatchedBy({ kind: "payment_record" }, ev(), OPENED)).toBe(true);
    expect(requirementMatchedBy({ kind: "email_reply" }, ev(), OPENED)).toBe(false);
  });
  it("needs the evidence to be fresh", () => {
    expect(requirementMatchedBy({ kind: "payment_record" }, ev({ fetchedAt: OPENED - 1 }), OPENED)).toBe(false);
  });
  it("needs a source with standing", () => {
    expect(requirementMatchedBy({ kind: "payment_record" }, ev({ sourceKind: "third_party" }), OPENED)).toBe(false);
  });
});

describe("evaluateCase: the close gate", () => {
  it("passes when every frozen requirement has fresh, authoritative evidence", () => {
    const result = evaluateCase(
      OPENED,
      [req(), req({ key: "order_ref", label: "Order reference", kind: "email_reply" })],
      [ev(), ev({ _id: "e2", kind: "email_reply", source: "reply from support", excerpt: "order 12345" })]
    );
    expect(result.ok).toBe(true);
    expect(Object.keys(result.satisfiedBy).sort()).toEqual(["order_ref", "refund_issued"]);
  });

  it("stays open when a requirement has no evidence at all", () => {
    const result = evaluateCase(OPENED, [req()], []);
    expect(result.ok).toBe(false);
    expect(result.unsatisfied[0].reason).toMatch(/no evidence of this kind/);
  });

  it("stays open and says why when the only evidence predates the case", () => {
    const result = evaluateCase(OPENED, [req()], [ev({ fetchedAt: OPENED - 5_000 })]);
    expect(result.ok).toBe(false);
    expect(result.unsatisfied[0].reason).toMatch(/read before the case opened/);
  });

  it("stays open when the evidence comes from a source with no standing", () => {
    const result = evaluateCase(OPENED, [req()], [ev({ sourceKind: "third_party" })]);
    expect(result.ok).toBe(false);
  });

  it("prefers the newest matching evidence when several exist", () => {
    const result = evaluateCase(
      OPENED,
      [req()],
      [ev({ _id: "old", fetchedAt: OPENED + 10 }), ev({ _id: "new", fetchedAt: OPENED + 900 })]
    );
    expect(result.satisfiedBy.refund_issued).toBe("new");
  });
});

describe("claim verdicts: unverifiable is not a soft failure", () => {
  it("no evidence at all is unverifiable", () => {
    expect(claimVerdict({ assertedAt: OPENED + 5 }, undefined, OPENED).verdict).toBe("unverifiable");
  });
  it("stale evidence is unverifiable even though evidence exists", () => {
    const v = claimVerdict({ assertedAt: OPENED + 5 }, ev({ fetchedAt: OPENED - 1 }), OPENED);
    expect(v.verdict).toBe("unverifiable");
    expect(v.reason).toMatch(/before the case opened/);
  });
  it("a source with no standing cannot verify a claim", () => {
    expect(claimVerdict({ assertedAt: OPENED + 5 }, ev({ sourceKind: "third_party" }), OPENED).verdict).toBe(
      "unverifiable"
    );
  });
  it("fresh authoritative evidence verifies, and the reason names the source", () => {
    const v = claimVerdict({ assertedAt: OPENED + 5 }, ev(), OPENED);
    expect(v.verdict).toBe("verified");
    expect(v.reason).toContain("https://example.com/orders/12345");
  });
});

describe("grades decide whether anything can be charged", () => {
  const pass: GradeCheck[] = [
    { name: "grounded", passed: true, detail: "every number has a fetch" },
    { name: "no_false_promise", passed: true, detail: "nothing promised beyond the record" },
  ];

  it("all passing checks is a pass", () => {
    expect(gradeVerdict(pass)).toBe("pass");
    expect(canBill("pass")).toBe(true);
  });

  it("one hard failure dominates everything else", () => {
    expect(gradeVerdict([...pass, { name: "no_false_promise", passed: false, detail: "promised Saturday" }])).toBe("fail");
    expect(canBill("fail")).toBe(false);
  });

  it("an unchecked rubric item is unverified, and unverified bills nothing", () => {
    expect(gradeVerdict([...pass, { name: "unverified", passed: false, detail: "transcript truncated" }])).toBe("unverified");
    expect(canBill("unverified")).toBe(false);
  });

  it("a missing grade can never bill", () => {
    expect(canBill("")).toBe(false);
    expect(canBill("pending")).toBe(false);
  });
});
