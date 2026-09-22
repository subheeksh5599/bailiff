import { action, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { configured, emailPath } from "./lib/config";
import { CHECKS, RUBRIC, rubricSummary, type CheckResult } from "./lib/checks";

/**
 * One call that asks the deployment what it can actually do.
 *
 * The landing page makes claims a reader can check with three commands; this is
 * the same thing in one, for a judge or an operator who would rather not assemble
 * them by hand. It is a read in spirit: the only thing it writes is a four-byte
 * file it immediately deletes, because "storage works" is not something that can
 * be answered by looking at configuration.
 *
 * A check that cannot run reports skipped with the reason, never a pass. A green
 * tick for a question that was never asked is the failure mode this whole product
 * is built against.
 */
export const run = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<{
    ok: boolean;
    ran: number;
    skipped: number;
    failed: number;
    checks: CheckResult[];
  }> => {
    const checks: CheckResult[] = [];

    // 1. What carries a key. Reported rather than asserted: the point is the list.
    const integrations = configured(process.env);
    const on = Object.entries(integrations).filter(([, value]) => value).map(([name]) => name);
    const off = Object.entries(integrations).filter(([, value]) => !value).map(([name]) => name);
    checks.push({
      name: "integrations",
      ok: true,
      skipped: false,
      detail: `${on.length} on (${on.join(", ")}); off: ${off.join(", ") || "none"}`,
    });

    // 2. Storage, by doing it: write a small file, read it back, delete it.
    try {
      const bytes = new Uint8Array([0x62, 0x61, 0x69, 0x6c]); // "bail"
      const storageId = await ctx.storage.store(new Blob([bytes]));
      const readBack = await ctx.storage.get(storageId);
      const size = readBack ? (await readBack.arrayBuffer()).byteLength : 0;
      await ctx.storage.delete(storageId);
      checks.push({
        name: "storage",
        ok: size === bytes.byteLength,
        skipped: false,
        detail:
          size === bytes.byteLength
            ? `wrote ${size} bytes, read them back, and removed them again`
            : `wrote ${bytes.byteLength} bytes and read back ${size}`,
      });
    } catch (error) {
      checks.push({
        name: "storage",
        ok: false,
        skipped: false,
        detail: `storage refused a write and read-back: ${error instanceof Error ? error.message : "unknown failure"}`,
      });
    }

    // 3. The mail path, which is what a report and a chase both depend on.
    const path = emailPath();
    checks.push({
      name: "mailPath",
      ok: path !== null,
      skipped: path === null ? true : false,
      detail:
        path === null
          ? "no mail path is configured (AGENTMAIL_API_KEY with AGENTMAIL_INBOX_ID, or RESEND_API_KEY with RESEND_FROM)"
          : `mail goes out through ${path}`,
    });

    // 4. The case table, so the board is not drawing from nothing.
    try {
      const count = await ctx.runQuery(internal.ops.caseCount, {});
      checks.push({
        name: "casesReadable",
        ok: true,
        skipped: false,
        detail: `${count} case(s) on the deployment`,
      });
    } catch (error) {
      checks.push({
        name: "casesReadable",
        ok: false,
        skipped: false,
        detail: `the case table could not be read: ${error instanceof Error ? error.message : "unknown failure"}`,
      });
    }

    // 5. The rubric this build grades with.
    checks.push(rubricSummary(RUBRIC));

    const failed = checks.filter((check) => !check.ok).length;
    const skipped = checks.filter((check) => check.skipped).length;
    return {
      ok: failed === 0,
      ran: checks.length,
      skipped,
      failed,
      checks,
    };
  },
});
