# Deployments

## Live

| | |
|---|---|
| Backend | `https://aware-jellyfish-285.convex.cloud` |
| Site and HTTP routes | `https://aware-jellyfish-285.convex.site` |
| Board | `https://aware-jellyfish-285.convex.site/board/index.html` |
| Health | `https://aware-jellyfish-285.convex.site/health` |

The functions, the environment and the static site all live on this one deployment,
so the product is a single address with no second hosting provider.

### How it was deployed

1. Functions and the hosting component, using the deployment's own key:
   `npx convex dev --once` with the key in the environment.
2. Environment, in one write: `npx convex env set --from-file .env.deployment`.
3. The site, built against this deployment's URL and uploaded:
   `NEXT_PUBLIC_CONVEX_URL=... npx next build`, then
   `npx @convex-dev/static-hosting upload -d web/out`.
4. The assistant's server URL points at this deployment, with the two tools that
   are the only route to a value during a call.

`scripts/deploy.sh` does all four, printing the health endpoint at the end.

### Retired

An earlier deployment (`colorless-chameleon-356`) holds the same functions but has no
environment of its own and could not be given one, so the site and the backend were
both moved to the deployment above. It is recorded here only so a stale URL in older
text can be recognised as such.

### Known limits

- Extraction cannot run until the provider has credit; a run before then stops with
  the provider's own error recorded on the case.
- Knowledge is unconfigured: the account has no organization, so the integration
  reports off rather than pretending.
- The site is served under the deployment's own subdomain. A custom domain is a paid
  feature and is not used; nothing in the product depends on one.
