/**
 * Test-side sign-in.
 *
 * The board's actions now require a session, so every suite that drives them needs
 * one. This keeps that to a single expression at the call site rather than a fixture
 * in each file: the passphrase hash goes into the environment the same way a
 * deployment receives it, and the token comes back from the real sign-in mutation.
 */

import { api } from "../convex/_generated/api";
import { sha256Hex } from "../convex/lib/hash";

export const TEST_PASSPHRASE = "an-operator-passphrase-for-tests-only";

// convex-test's client is generic over the schema, so no structural type describes it
// without reaching into its internals. It is taken as unknown and narrowed to the one
// method this needs, at the one place that reads the result.
export async function operatorToken(t: unknown): Promise<string> {
  const client = t as { mutation: (fn: unknown, args: unknown) => Promise<{ token: string }> };
  process.env.OPERATOR_PASSPHRASE_HASH = await sha256Hex(TEST_PASSPHRASE);
  const { token } = await client.mutation(api.auth.signIn, { passphrase: TEST_PASSPHRASE });
  return token;
}
