/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as billing from "../billing.js";
import type * as cases from "../cases.js";
import type * as crons from "../crons.js";
import type * as grades from "../grades.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as lib_hash from "../lib/hash.js";
import type * as lib_rules from "../lib/rules.js";
import type * as lib_states from "../lib/states.js";
import type * as recheck from "../recheck.js";
import type * as verifier from "../verifier.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  billing: typeof billing;
  cases: typeof cases;
  crons: typeof crons;
  grades: typeof grades;
  http: typeof http;
  ingest: typeof ingest;
  "lib/hash": typeof lib_hash;
  "lib/rules": typeof lib_rules;
  "lib/states": typeof lib_states;
  recheck: typeof recheck;
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

export declare const components: {};
