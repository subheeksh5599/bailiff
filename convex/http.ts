import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components } from "./_generated/api";
import { registerHooks } from "./http/hooks";
import { registerReads } from "./http/reads";

/**
 * The router, and nothing else.
 *
 * The routes themselves live in two files split by who calls them - reads anyone
 * may make, and hooks that only ever run with a shared secret. This file exists to
 * put them in the order that matters: the exact routes first, and the built site
 * last, so an unknown path falls through to the site rather than shadowing a
 * route that does something.
 */
const http = httpRouter();

registerReads(http);
registerHooks(http);

// Last, so every exact route above wins: unknown paths fall through to the built
// site, which is what makes a browser refresh on a case work.
registerStaticRoutes(http, components.staticHosting);

export { extractCaseRef } from "./http/hooks";

export default http;
