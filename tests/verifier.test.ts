import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { staleEvidenceIds } from "../convex/verifier";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js"]);

/**
 * Two things are worth pinning here that the end-to-end tests cannot reach.
 *
 * First, staleness at the function: evidence outlives its usefulness on its own, and
 * a read from before the case existed is a different thing from a read that has aged.
 * Second, and more important: the verifier decides from the rows every time it is
 * asked. A row that claims a requirement is satisfied, with no evidence behind it, is
 * exactly the lie this product exists to refuse.
 */
const DAY = 86_400_000;
const OPENED = 1_700_000_000_000;

const read = (fetchedAt: number, id = "ev-1") => ({
  _id: id,
  kind: "email_reply",
  sourceKind: "counterparty" as const,
  source: "billing@example.com",
  fetchedAt,
  // the schema holds the amount as units, with the rendered figure alongside it
  value: "128.40",
  valueUnits: 12840,
  excerpt: "refund issued",
});

describe("evidence goes stale on its own", () => {
  it("leaves a read inside its life alone", () => {
    const now = OPENED + 2 * DAY;
    expect(staleEvidenceIds([read(OPENED + DAY)], OPENED, now, 7 * DAY)).toEqual([]);
  });

  it("names a read that has outlived its life", () => {
    const now = OPENED + 30 * DAY;
    expect(staleEvidenceIds([read(OPENED + DAY)], OPENED, now, 7 * DAY)).toEqual(["ev-1"]);
  });

  it("does not call a read from before the case stale, because it was never valid", () => {
    const now = OPENED + 30 * DAY;
    expect(staleEvidenceIds([read(OPENED - DAY)], OPENED, now, 7 * DAY)).toEqual([]);
  });

  it("still names a read with no row of its own, so there is something to point at", () => {
    const now = OPENED + 30 * DAY;
    const anonymous = { ...read(OPENED + DAY), _id: undefined };
    expect(staleEvidenceIds([anonymous], OPENED, now, 7 * DAY)).toEqual([
      `billing@example.com@${OPENED + DAY}`,
    ]);
  });

  it("treats the boundary as inside, and only past it as expired", () => {
    const readAt = OPENED + DAY;
    const exactlyAtTheLimit = readAt + 7 * DAY;
    expect(staleEvidenceIds([read(readAt)], OPENED, exactlyAtTheLimit, 7 * DAY)).toEqual([]);
    expect(staleEvidenceIds([read(readAt)], OPENED, exactlyAtTheLimit + 1, 7 * DAY)).toEqual(["ev-1"]);
  });
});

describe("the verifier decides again every time, and trusts no flag", () => {
  async function seeded() {
    const t = convexTest(schema, modules);
    const { caseId } = await t.mutation(api.cases.openCase, {
      ref: "case-flag",
      customerRef: "cust-flag",
      counterpartyName: "Example Corp",
      channel: "phone",
    });
    await t.mutation(api.cases.freezeRequirements, {
      caseId,
      actor: "intake",
      requirements: [
        { key: "refund_moved", label: "their own record shows the refund moved", kind: "email_reply" },
      ],
    });
    return { t, caseId };
  }

  it("refuses a requirement that claims to be satisfied while no evidence backs it", async () => {
    const { t, caseId } = await seeded();

    // Write the lie directly into the row: satisfied, with nothing behind it.
    await t.run(async (ctx) => {
      const requirement = await ctx.db.query("requirements").first();
      await ctx.db.patch(requirement!._id, { satisfied: true, satisfiedByEvidenceId: undefined });
    });

    const result = await t.mutation(api.cases.attemptClose, { caseId, actor: "board" });
    expect(result.closed).toBe(false);
    expect((result.unsatisfied ?? []).map((u: { key: string }) => u.key)).toContain("refund_moved");
  });

  it("refuses while there is nothing at all behind the requirement", async () => {
    const { t, caseId } = await seeded();
    const result = await t.mutation(api.cases.attemptClose, { caseId, actor: "board" });
    expect(result.closed).toBe(false);
    expect((result.unsatisfied ?? []).length).toBeGreaterThan(0);
  });
});
