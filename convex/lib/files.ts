/**
 * What may be filed as a document, and what may not.
 *
 * A case collects the owner's paperwork: a statement, a screenshot of a portal, a
 * PDF of an invoice. Those are the files this product exists to hold onto, and
 * they arrive in whatever form the person happens to have. So the rule is not
 * "PDF only" - it is a size ceiling, a small allow-list of types that can be read
 * back, and a refusal that says which of the two it tripped.
 *
 * The rules are pure so the refusal can be tested without uploading anything.
 */

/** 12 MB: comfortably a phone photo or a scanned statement, far from a video. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/** Types a case can hold. Anything else is refused with a reason, not silently dropped. */
export const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  txt: "text/plain",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * The type to record.
 *
 * What the browser reports and what the extension says disagree often enough - a
 * scanner uploading a PDF it calls `application/octet-stream`, a photo named
 * `.jpeg` - so the extension is the tie-break rather than a nicety.
 */
export function resolveType(reported: string | undefined, fileName: string): string | null {
  const clean = (reported ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if ((ALLOWED_TYPES as readonly string[]).includes(clean)) return clean;

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const byExtension = BY_EXTENSION[extension];
  if (byExtension) return byExtension;

  return null;
}

export type FileRefusal = { ok: false; reason: string };
export type FileAccepted = { ok: true; type: string; bytes: number };

export function checkUpload(input: {
  fileName: string;
  reportedType: string | undefined;
  bytes: number;
}): FileAccepted | FileRefusal {
  const name = input.fileName.trim();
  if (name.length === 0) return { ok: false, reason: "the file has no name" };
  if (input.bytes <= 0) return { ok: false, reason: "the file is empty" };
  if (input.bytes > MAX_UPLOAD_BYTES) {
    const mb = (input.bytes / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      reason: `the file is ${mb} MB and the ceiling is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`,
    };
  }

  const type = resolveType(input.reportedType, name);
  if (!type) {
    return {
      ok: false,
      reason: `a file of this type cannot be read back; allowed: ${ALLOWED_TYPES.join(", ")}`,
    };
  }

  return { ok: true, type, bytes: input.bytes };
}

/** How the file is described on the case, in the row a reader actually sees. */
export function describeFile(input: {
  fileName: string;
  type: string;
  bytes: number;
  hash: string;
}): string {
  const size =
    input.bytes >= 1024 * 1024
      ? `${(input.bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(input.bytes / 1024))} KB`;
  return `${input.fileName} · ${input.type} · ${size} · sha256 ${input.hash.slice(0, 16)}…`;
}
