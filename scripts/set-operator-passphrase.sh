#!/usr/bin/env bash
# Change the passphrase the board asks for.
#
# The passphrase is read without echoing, hashed locally, and only the hash is sent to
# the deployment - so the plaintext never appears on a command line, in a process list,
# or in the deployment's environment. The plaintext lives in .env.local, which is
# git-ignored and mode 600.
#
# Usage:  ./scripts/set-operator-passphrase.sh            (asks twice, then sets it)
#         ./scripts/set-operator-passphrase.sh --dry-run  (everything except the changes)
set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN=""
[ "${1:-}" = "--dry-run" ] && DRY_RUN="yes"

read -r -s -p "new operator passphrase: " PASS; echo
if [ -z "$DRY_RUN" ]; then
  read -r -s -p "same again: " AGAIN; echo
  [ "$PASS" = "$AGAIN" ] || { echo "those do not match; nothing changed"; exit 1; }
fi

if [ "${#PASS}" -lt 8 ]; then
  echo "that is shorter than 8 characters; nothing changed"
  exit 1
fi

HASH=$(printf %s "$PASS" | sha256sum | cut -d' ' -f1)
echo "hash: ${HASH:0:16}…"

# Update the two env files in place, keeping exactly one line for each name.
printf %s "$PASS" | python3 - "$HASH" "$DRY_RUN" <<'PY'
import pathlib, sys

hash_value, dry = sys.argv[1], sys.argv[2]
plain = sys.stdin.read()
changed = []

for path, name, value in [
    (pathlib.Path(".env.local"), "OPERATOR_PASSPHRASE", plain),
    (pathlib.Path(".env.local"), "OPERATOR_PASSPHRASE_HASH", hash_value),
    (pathlib.Path(".env.deployment"), "OPERATOR_PASSPHRASE_HASH", hash_value),
]:
    if not path.exists():
        continue
    lines = [l for l in path.read_text().splitlines() if not l.startswith(f"{name}=")]
    lines.append(f"{name}={value}")
    if dry:
        print(f"  would write {name} to {path}")
    else:
        path.write_text("\n".join(lines) + "\n")
        path.chmod(0o600)
        changed.append(f"{path}:{name}")

if not dry:
    print("  updated:", ", ".join(changed) if changed else "nothing")
PY

if [ -n "$DRY_RUN" ]; then
  echo "dry run: the deployment was not touched"
  exit 0
fi

if [ -z "${CONVEX_DEPLOY_KEY:-}" ] && [ -f .env.local ]; then
  CONVEX_DEPLOY_KEY=$(grep -E '^CONVEX_DEPLOY_KEY=' .env.local | cut -d= -f2- || true)
fi
[ -n "${CONVEX_DEPLOY_KEY:-}" ] || { echo "no CONVEX_DEPLOY_KEY; the deployment still expects the old passphrase"; exit 1; }
export CONVEX_DEPLOY_KEY

echo "pushing the hash to the deployment (the hash only)…"
npx convex env set OPERATOR_PASSPHRASE_HASH "$HASH" >/dev/null

echo
echo "Done. The deployment now expects the passphrase you just typed."
echo "It is stored in plaintext only in .env.local — that is the one to read if you forget it."
echo "Anyone the passphrase is shown to can act on this board, so change it again after recording."
