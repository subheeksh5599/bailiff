import { defineApp } from "convex/server";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";

/**
 * The static site and the backend live on one deployment.
 *
 * The component is mounted without its own http prefix on purpose: this app's HTTP
 * routes are the product's front door (the phone system's tool calls, the mailbox
 * webhook, the health endpoint), and moving them to satisfy a hosting convenience
 * would mean re-pointing live callbacks. Instead the catch-all is registered inside
 * our own router, after every exact route, so nothing that already works changes
 * address.
 */
const app = defineApp();
app.use(staticHosting);
// The public hooks are the only way evidence gets in, so they are the surface that
// needs a ceiling: a runaway integration or a loop should not be able to hammer one
// case or the deployment.
app.use(rateLimiter);

export default app;
