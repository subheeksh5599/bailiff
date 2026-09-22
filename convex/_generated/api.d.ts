/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attachments from "../attachments.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as board from "../board.js";
import type * as cases from "../cases.js";
import type * as chase from "../chase.js";
import type * as crons from "../crons.js";
import type * as grades from "../grades.js";
import type * as http from "../http.js";
import type * as http_hooks from "../http/hooks.js";
import type * as http_json from "../http/json.js";
import type * as http_reads from "../http/reads.js";
import type * as ingest from "../ingest.js";
import type * as insights from "../insights.js";
import type * as integrations_agentmail from "../integrations/agentmail.js";
import type * as integrations_autumn from "../integrations/autumn.js";
import type * as integrations_endpoints from "../integrations/endpoints.js";
import type * as integrations_firecrawl from "../integrations/firecrawl.js";
import type * as integrations_http from "../integrations/http.js";
import type * as integrations_inkeep from "../integrations/inkeep.js";
import type * as integrations_openai from "../integrations/openai.js";
import type * as integrations_resend from "../integrations/resend.js";
import type * as integrations_scorecard from "../integrations/scorecard.js";
import type * as integrations_vapi from "../integrations/vapi.js";
import type * as lib_analysis from "../lib/analysis.js";
import type * as lib_cadence from "../lib/cadence.js";
import type * as lib_checks from "../lib/checks.js";
import type * as lib_config from "../lib/config.js";
import type * as lib_files from "../lib/files.js";
import type * as lib_hash from "../lib/hash.js";
import type * as lib_messages from "../lib/messages.js";
import type * as lib_metrics from "../lib/metrics.js";
import type * as lib_rules from "../lib/rules.js";
import type * as lib_session from "../lib/session.js";
import type * as lib_states from "../lib/states.js";
import type * as ops from "../ops.js";
import type * as orchestrator from "../orchestrator.js";
import type * as recheck from "../recheck.js";
import type * as selftest from "../selftest.js";
import type * as verifier from "../verifier.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attachments: typeof attachments;
  auth: typeof auth;
  billing: typeof billing;
  board: typeof board;
  cases: typeof cases;
  chase: typeof chase;
  crons: typeof crons;
  grades: typeof grades;
  http: typeof http;
  "http/hooks": typeof http_hooks;
  "http/json": typeof http_json;
  "http/reads": typeof http_reads;
  ingest: typeof ingest;
  insights: typeof insights;
  "integrations/agentmail": typeof integrations_agentmail;
  "integrations/autumn": typeof integrations_autumn;
  "integrations/endpoints": typeof integrations_endpoints;
  "integrations/firecrawl": typeof integrations_firecrawl;
  "integrations/http": typeof integrations_http;
  "integrations/inkeep": typeof integrations_inkeep;
  "integrations/openai": typeof integrations_openai;
  "integrations/resend": typeof integrations_resend;
  "integrations/scorecard": typeof integrations_scorecard;
  "integrations/vapi": typeof integrations_vapi;
  "lib/analysis": typeof lib_analysis;
  "lib/cadence": typeof lib_cadence;
  "lib/checks": typeof lib_checks;
  "lib/config": typeof lib_config;
  "lib/files": typeof lib_files;
  "lib/hash": typeof lib_hash;
  "lib/messages": typeof lib_messages;
  "lib/metrics": typeof lib_metrics;
  "lib/rules": typeof lib_rules;
  "lib/session": typeof lib_session;
  "lib/states": typeof lib_states;
  ops: typeof ops;
  orchestrator: typeof orchestrator;
  recheck: typeof recheck;
  selftest: typeof selftest;
  verifier: typeof verifier;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
