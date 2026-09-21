import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { gradeVerdict } from "./lib/rules";

/**
 * Grades are produced by the evaluator, not by the party being graded.
 *
 * `checks` is what was actually run, check by check, with the detail a human can
 * argue with. The verdict is derived here, in one place, so no caller can post a
 * "pass" that its own checks do not support.
 */
export const recordGrade = mutation({
  args: {
    subjectKind: v.string(),
    subjectRef: v.string(),
    rubricRef: v.string(),
    checks: v.array(
      v.object({ name: v.string(), passed: v.boolean(), detail: v.string() })
    ),
    gradedBy: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.checks.length === 0) {
      throw new Error("refused: a grade with no checks is not a grade");
    }
    const verdict = gradeVerdict(args.checks);
    const failed = args.checks.filter((c) => !c.passed).map((c) => c.name);
    const score =
      args.checks.filter((c) => c.passed).length / args.checks.length;
    const gradedAt = Date.now();
    const gradeId = await ctx.db.insert("grades", {
      subjectKind: args.subjectKind,
      subjectRef: args.subjectRef,
      rubricRef: args.rubricRef,
      verdict,
      score,
      checks: args.checks,
      gradedBy: args.gradedBy,
      gradedAt,
    });
    await ctx.db.insert("audit", {
      actor: args.gradedBy,
      action: "grade.recorded",
      detail: `${verdict} (${score.toFixed(2)}) for ${args.subjectKind} ${args.subjectRef}${
        failed.length ? `; failed: ${failed.join(", ")}` : ""
      }`,
      at: gradedAt,
    });
    return { gradeId, verdict, score, failedChecks: failed };
  },
});

export const forSubject = query({
  args: { subjectKind: v.string(), subjectRef: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("grades")
      .withIndex("by_subject", (q) =>
        q.eq("subjectKind", args.subjectKind).eq("subjectRef", args.subjectRef)
      )
      .collect();
    return rows.sort((a, b) => b.gradedAt - a.gradedAt);
  },
});
