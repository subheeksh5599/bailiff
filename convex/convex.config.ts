import { defineApp } from "convex/server";
import staticHosting from "@convex-dev/static-hosting/convex.config";

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

export default app;
