/**
 * Content hashing for evidence.
 *
 * Every evidence row stores the hash of exactly what was read, so a later reader
 * can re-fetch the source and see whether the world still agrees. SHA-256 via
 * WebCrypto keeps this identical in the Convex runtime and in tests.
 */

const enc = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Stable serialisation: key order cannot change the hash. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export async function requirementSetHash(
  requirements: Array<{ key: string; kind: string }>
): Promise<string> {
  return sha256Hex(canonicalJson([...requirements].sort((a, b) => (a.key < b.key ? -1 : 1))));
}
