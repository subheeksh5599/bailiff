import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { MAX_UPLOAD_BYTES, checkUpload, describeFile, resolveType } from "../convex/lib/files";
import { operatorToken } from "./helpers";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js"]);

function harness() {
  return convexTest(schema, modules);
}

async function caseWithRequirement(
  t: ReturnType<typeof harness>,
  ref = "case-files",
  kind = "own_document"
) {
  const { caseId } = await t.mutation(api.cases.openCase, {
    ref,
    customerRef: "cust-1",
    counterpartyName: "Example Corp",
    channel: "phone",
  });
  await t.mutation(api.cases.freezeRequirements, {
    caseId,
    requirements: [{ key: "statement", label: "the statement is on file", kind }],
    actor: "intake",
  });
  return caseId;
}

describe("what may be filed", () => {
  it("takes the extension as the tie-break when the browser reports nothing useful", () => {
    expect(resolveType("application/octet-stream", "statement.pdf")).toBe("application/pdf");
    expect(resolveType(undefined, "photo.HEIC")).toBe("image/heic");
    expect(resolveType("image/png; charset=binary", "shot.png")).toBe("image/png");
  });

  it("refuses a type it cannot read back, and says which", () => {
    expect(resolveType("application/zip", "archive.zip")).toBeNull();
    const verdict = checkUpload({ fileName: "archive.zip", reportedType: "application/zip", bytes: 1024 });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("cannot be read back");
  });

  it("refuses an empty file and one over the ceiling, naming the ceiling", () => {
    const empty = checkUpload({ fileName: "a.pdf", reportedType: "application/pdf", bytes: 0 });
    expect(empty.ok).toBe(false);

    const huge = checkUpload({
      fileName: "a.pdf",
      reportedType: "application/pdf",
      bytes: MAX_UPLOAD_BYTES + 1,
    });
    expect(huge.ok).toBe(false);
    if (!huge.ok) expect(huge.reason).toContain("ceiling");
  });

  it("describes a file the way the case row reads", () => {
    const text = describeFile({
      fileName: "statement.pdf",
      type: "application/pdf",
      bytes: 240 * 1024,
      hash: "a".repeat(64),
    });
    expect(text).toContain("statement.pdf");
    expect(text).toContain("240 KB");
    expect(text).toContain("sha256 aaaaaaaaaaaaaaaa…");
  });
});

describe("filing an uploaded document", () => {
  it("hashes the bytes that actually arrived and files them on the case", async () => {
    const t = harness();
    await caseWithRequirement(t, "case-upload", "own_document");
    const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob([new Uint8Array([1, 2, 3, 4, 5])])));

    const filed = await t.action(api.attachments.attach, {
    token: await operatorToken(t),
      caseRef: "case-upload",
      storageId,
      fileName: "statement.pdf",
      reportedType: "application/octet-stream",
      note: "the statement they sent in March",
    });

    expect(filed.contentHash).toHaveLength(64);
    expect(filed.satisfies).toEqual(["statement"]);

    const snapshot = await t.query(api.cases.get, { ref: "case-upload" });
    const row = snapshot?.evidence.find((e) => e.source === "statement.pdf");
    expect(row?.storageId).toBe(storageId);
    expect(row?.mimeType).toBe("application/pdf");
    expect(row?.sizeBytes).toBe(5);
    expect(row?.sourceKind).toBe("own_record");
    expect(row?.contentHash).toBe(filed.contentHash);

    // the file can be read back, and the case says what satisfied it
    expect(await t.query(api.attachments.fileUrl, { evidenceId: row!._id })).toBeTruthy();
    expect(snapshot?.requirements[0]?.satisfied).toBe(true);
    expect(snapshot?.requirements[0]?.satisfiedByEvidenceId).toBe(row!._id);
  });

  it("refuses a file it cannot read back, and keeps nothing in storage", async () => {
    const t = harness();
    await caseWithRequirement(t, "case-badfile");
    const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob([new Uint8Array([9, 9, 9])])));

    await expect(
      t.action(api.attachments.attach, {
    token: await operatorToken(t),
        caseRef: "case-badfile",
        storageId,
        fileName: "installer.exe",
        reportedType: "application/x-msdownload",
      })
    ).rejects.toThrow(/refused: a file of this type cannot be read back/);

    // the unusable upload is gone rather than left behind
    expect(await t.run(async (ctx) => await ctx.storage.get(storageId))).toBeNull();
  });

  it("will not file anything against a case that is already settled", async () => {
    const t = harness();
    const caseId = await caseWithRequirement(t, "case-settled");
    const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob([new Uint8Array([7])])));

    // satisfy it and close it, so the case is VERIFIED
    await t.mutation(api.cases.attemptClose, { token: await operatorToken(t), caseId, actor: "tester" }).catch(() => undefined);
    await t.run(async (ctx) => {
      await ctx.db.patch(caseId, { state: "VERIFIED" });
    });

    await expect(
      t.action(api.attachments.attach, {
    token: await operatorToken(t),
        caseRef: "case-settled",
        storageId,
        fileName: "later.pdf",
        reportedType: "application/pdf",
      })
    ).rejects.toThrow(/settled cases are not fed new evidence/);
  });

  it("does not let an owner's file satisfy a requirement that asks for the other side's", async () => {
    const t = harness();
    await caseWithRequirement(t, "case-theirs", "email_reply");
    const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob([new Uint8Array([1])])));

    const filed = await t.action(api.attachments.attach, {
    token: await operatorToken(t),
      caseRef: "case-theirs",
      storageId,
      fileName: "my-own-note.pdf",
      reportedType: "application/pdf",
      kind: "own_document",
    });

    expect(filed.satisfies).toEqual([]);
    const snapshot = await t.query(api.cases.get, { ref: "case-theirs" });
    expect(snapshot?.requirements[0]?.satisfied).toBe(false);
  });
});
