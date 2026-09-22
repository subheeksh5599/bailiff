import { v } from "convex/values";
import { action, internalMutation, mutation, query, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { checkUpload, describeFile } from "./lib/files";
import { sha256HexOfBytes } from "./lib/hash";
import { requirementMatchedBy } from "./lib/rules";

/**
 * The owner's paperwork, as files.
 *
 * A statement is a PDF or a photograph of a screen, not a paragraph somebody
 * retyped. Uploading works in three steps and takes two of them on the server:
 * the browser asks for a URL and puts the bytes there, then this reads the file
 * back out of storage, hashes what actually arrived, checks it against the rules,
 * and files it on the case. The hash is of the bytes rather than of a description
 * of them, so the row on the case can be checked against the file later.
 *
 * A file is the owner's own record and is filed as one, exactly like a typed
 * document: it can satisfy a requirement that asks for something of the same
 * kind, and it can never satisfy one that asks for the other side's.
 */

/** Step one: where the browser may put the bytes. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** Step two, on the server: read the bytes, hash them, and file them. */
export const attach = action({
  args: {
    caseRef: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    reportedType: v.optional(v.string()),
    kind: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (
    ctx: ActionCtx,
    args
  ): Promise<{ evidenceId: string; contentHash: string; satisfies: string[]; description: string }> => {
    const snapshot = await ctx.runQuery(api.cases.get, { ref: args.caseRef });
    if (!snapshot) throw new Error(`no case ${args.caseRef}`);
    if (snapshot.case.state === "VERIFIED") {
      throw new Error("refused: this case is settled, and settled cases are not fed new evidence");
    }

    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new Error("refused: the file is not in storage; nothing was filed");

    const bytes = await blob.arrayBuffer();
    const verdict = checkUpload({
      fileName: args.fileName,
      reportedType: args.reportedType ?? blob.type,
      bytes: bytes.byteLength,
    });
    if (!verdict.ok) {
      // The rejected upload is still removed: an unusable file left in storage is
      // a bill with nothing to show for it.
      await ctx.storage.delete(args.storageId);
      throw new Error(`refused: ${verdict.reason}`);
    }

    const contentHash = await sha256HexOfBytes(bytes);
    const kind = args.kind?.trim() || "own_document";
    const description = describeFile({
      fileName: args.fileName,
      type: verdict.type,
      bytes: bytes.byteLength,
      hash: contentHash,
    });

    const written = await ctx.runMutation(internal.attachments.record, {
      caseRef: args.caseRef,
      storageId: args.storageId,
      kind,
      contentHash,
      description,
      fileName: args.fileName,
      mimeType: verdict.type,
      sizeBytes: bytes.byteLength,
      ...(args.note?.trim() ? { note: args.note.trim() } : {}),
    });

    return { ...written, description };
  },
});

/** Step three: the row on the case, written where every other piece of evidence is. */
export const record = internalMutation({
  args: {
    caseRef: v.string(),
    storageId: v.id("_storage"),
    kind: v.string(),
    contentHash: v.string(),
    description: v.string(),
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db
      .query("cases")
      .withIndex("by_ref", (q) => q.eq("ref", args.caseRef))
      .unique();
    if (!caseDoc) throw new Error(`no case ${args.caseRef}`);

    const fetchedAt = Date.now();
    const evidenceId = await ctx.db.insert("evidence", {
      caseId: caseDoc._id,
      kind: args.kind,
      sourceKind: "own_record",
      source: args.fileName,
      fetchedAt,
      contentHash: args.contentHash,
      excerpt: args.note ? `${args.description}\n\n${args.note}` : args.description,
      ingestedBy: "board-upload",
      storageId: args.storageId,
      fileName: args.fileName,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
    });

    // The same matching every other piece of evidence goes through: same kind,
    // read after the case opened, so an upload cannot shortcut the rules.
    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_case", (q) => q.eq("caseId", caseDoc._id))
      .collect();
    const satisfies: string[] = [];
    for (const requirement of requirements) {
      if (requirement.satisfied) continue;
      // The same rule the close gate applies, called directly: a requirement is
      // satisfied by evidence of the same kind, read after the case opened, from a
      // source that speaks for this side of it.
      const matches = requirementMatchedBy(
        { kind: requirement.kind },
        { kind: args.kind, sourceKind: "own_record", fetchedAt },
        caseDoc.openedAt
      );
      if (matches) {
        await ctx.db.patch(requirement._id, {
          satisfied: true,
          satisfiedByEvidenceId: evidenceId,
        });
        satisfies.push(requirement.key);
      }
    }

    await ctx.db.insert("audit", {
      caseId: caseDoc._id,
      actor: "board-upload",
      action: "evidence.filed",
      detail: `${args.kind} from ${args.fileName} (${args.sizeBytes} bytes, hash ${args.contentHash.slice(0, 12)})${
        satisfies.length ? ` satisfies ${satisfies.join(", ")}` : ""
      }`,
      at: fetchedAt,
    });

    return { evidenceId, contentHash: args.contentHash, satisfies };
  },
});

/**
 * Where a filed document can be read back.
 *
 * The URL is asked for by evidence row rather than handed out with the list, so a
 * settled case does not carry live download links it no longer needs, and a row
 * with no file behind it returns null rather than an address to nothing.
 */
export const fileUrl = query({
  args: { evidenceId: v.id("evidence") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.evidenceId);
    if (!row || !row.storageId) return null;
    return await ctx.storage.getUrl(row.storageId);
  },
});
