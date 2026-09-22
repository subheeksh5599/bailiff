/**
 * The checks a reader can run against a live deployment.
 *
 * These are the same claims the landing page makes, in the same order, so the
 * page and this share one definition rather than two that drift. Each check says
 * what it proves and what it needs: a check whose key is absent reports itself as
 * skipped rather than passing, because "I could not ask" and "the answer is yes"
 * are different answers.
 */

export type CheckName =
  | "integrations"
  | "storage"
  | "mailPath"
  | "casesReadable"
  | "rubricPresent";

export type CheckDefinition = {
  name: CheckName;
  proves: string;
  needs: string | null;
};

export const CHECKS: CheckDefinition[] = [
  {
    name: "integrations",
    proves: "each integration reports whether it carries a key, including the ones that do not",
    needs: null,
  },
  {
    name: "storage",
    proves: "a file can be written and read back, which is what filing documents depends on",
    needs: null,
  },
  {
    name: "mailPath",
    proves: "there is a way to send the case's mail, and which way it is",
    needs: null,
  },
  {
    name: "casesReadable",
    proves: "the case table can be read, so the board is not drawing from nothing",
    needs: null,
  },
  {
    name: "rubricPresent",
    proves: "the checks a grade is made of are the ones this build knows about",
    needs: null,
  },
];

export type CheckResult = {
  name: CheckName;
  ok: boolean;
  skipped: boolean;
  detail: string;
};

export const RUBRIC = ["promises_on_record", "unverified", "resolved"] as const;

/** The grade's checks, as the selftest sees them: present, and named. */
export function rubricSummary(checks: readonly string[]): CheckResult {
  const missing = RUBRIC.filter((name) => !checks.includes(name));
  return {
    name: "rubricPresent",
    ok: missing.length === 0,
    skipped: false,
    detail:
      missing.length === 0
        ? `every check a grade is made of is present: ${RUBRIC.join(", ")}`
        : `missing from this build: ${missing.join(", ")}`,
  };
}
