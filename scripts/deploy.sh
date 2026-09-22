#!/usr/bin/env bash
# Push this backend to the owner's Convex deployment and set its variables.
#
# Two things make this safe to run repeatedly:
#   - the deploy key is read from the environment, so it never appears on a command line;
#   - deployment variables are pushed with `env set --from-file`, so no value is ever
#     passed as an argument, logged, or shown in a process list.
#
# Usage:  export CONVEX_DEPLOY_KEY=...   (dashboard -> project -> Settings -> Deploy Keys)
#         ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${CONVEX_DEPLOY_KEY:-}" ]; then
  if [ -f .env.local ]; then
    CONVEX_DEPLOY_KEY=$(grep -E '^CONVEX_DEPLOY_KEY=' .env.local | cut -d= -f2- || true)
  fi
fi
[ -n "${CONVEX_DEPLOY_KEY:-}" ] || { echo "no CONVEX_DEPLOY_KEY: set it or add it to .env.local"; exit 1; }
export CONVEX_DEPLOY_KEY

echo "== deploying functions =="
npx convex deploy --yes

echo "== pushing deployment variables (names only are printed) =="
npx convex env set --from-file .env.deployment

# `convex dev` rewrites the CONVEX_* lines in .env.local with the local URLs, so the
# cloud address is read from .env.cloud first rather than from whatever the CLI last wrote.
SITE=$(grep -E '^CONVEX_SITE_URL=.*convex\.site' .env.cloud 2>/dev/null | cut -d= -f2- || true)
[ -n "$SITE" ] || SITE=$(grep -E '^CONVEX_SITE_URL=.*convex\.site' .env.local 2>/dev/null | cut -d= -f2- || true)
[ -n "$SITE" ] || { echo "no cloud site url: put CONVEX_SITE_URL=https://<deployment>.convex.site in .env.cloud"; exit 1; }
echo "== health of $SITE =="
curl -s --max-time 30 "$SITE/health" | python3 -m json.tool
