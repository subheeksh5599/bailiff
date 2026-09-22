/**
 * Rate limits for the public hooks.
 *
 * Every hook is already fail-closed without its shared secret, but a correct caller
 * can still arrive far too often: a provider retrying, a loop in someone's cron, or a
 * burst that arrives all at once. These are the ceilings.
 *
 * Two limits apply to every hook, because they answer different questions. The global
 * one bounds what the deployment absorbs in total; the per-case one bounds what any
 * single case can be asked to absorb, so a flood aimed at one case cannot consume the
 * allowance of every other case.
 *
 * A token bucket rather than a fixed window, so a genuine short burst (a call ending
 * as a reply lands) is allowed through while a sustained flood is not.
 */

import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

export const POLICIES = {
  hookAll: { kind: "token bucket" as const, rate: 240, period: MINUTE, capacity: 60 },
  hookPerCase: { kind: "token bucket" as const, rate: 30, period: MINUTE, capacity: 10 },
  operatorAction: { kind: "token bucket" as const, rate: 120, period: MINUTE, capacity: 30 },
};

export type LimitName = keyof typeof POLICIES;

/** Plain description of each ceiling, for the board and the readme to print. */
export function policyTable(): Array<{ name: LimitName; per: string; burst: number }> {
  return (Object.keys(POLICIES) as LimitName[]).map((name) => {
    const policy = POLICIES[name];
    const perMinute = Math.round((policy.rate / policy.period) * MINUTE);
    return { name, per: `${perMinute} per minute`, burst: policy.capacity };
  });
}

export const rateLimiter = new RateLimiter(components.rateLimiter, POLICIES);
