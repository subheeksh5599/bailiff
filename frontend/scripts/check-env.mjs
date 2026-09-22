/**
 * A panel built without its deployment address has nothing to read, and it fails
 * quietly: the export succeeds, the upload succeeds, and the site opens empty.
 * That is worth stopping at build time rather than discovering in front of a judge.
 */
import { readFileSync, existsSync } from "node:fs";

const files = [".env.local", ".env.production", ".env.production.local", ".env"];
let found = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";

if (!found) {
  for (const file of files) {
    if (!existsSync(file)) continue;
    const line = readFileSync(file, "utf8")
      .split("\n")
      .find((l) => l.startsWith("NEXT_PUBLIC_CONVEX_URL="));
    if (line) {
      found = line.slice("NEXT_PUBLIC_CONVEX_URL=".length).trim();
      break;
    }
  }
}

if (!found || found.includes("<")) {
  console.error(
    "\n  NEXT_PUBLIC_CONVEX_URL is not set, so this build would have no backend:\n" +
      "  the export would succeed and the site would open with nothing behind it.\n\n" +
      "  Put the deployment's cloud address in frontend/.env.local:\n" +
      "    NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud\n",
  );
  process.exit(1);
}
console.log(`  backend: ${found}`);
