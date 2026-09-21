import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { ENDPOINTS } from "./endpoints";
import { postJson } from "./http";
import { NotConfigured, has, requireKey } from "../lib/config";

/**
 * Adapter: tell the meter that one unit happened.
 *
 * Deliberately dumb. It does not decide whether anything is billable - that was
 * decided before this call, by the gate, and the row proving it already exists.
 * A failure is reported as a failure so the caller can retry under the same key
 * instead of charging twice.
 */
export function buildTrackRequest(input: {
  customerId: string;
  featureId: string;
  units: number;
  idempotencyKey: string;
  properties?: Record<string, string>;
}) {
  return {
    customer_id: input.customerId,
    feature_id: input.featureId,
    value: input.units,
    idempotency_key: input.idempotencyKey,
    properties: input.properties ?? {},
  };
}

export type UsageReport =
  | { sent: true; meterEventId: string | null }
  | { sent: false; error: string; retryable: true };

export const trackUsage = internalAction({
  args: {
    customerId: v.string(),
    featureId: v.string(),
    units: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (_ctx: ActionCtx, args): Promise<UsageReport> => {
    if (!has(process.env, "autumn")) throw new NotConfigured("metering", "AUTUMN_SECRET_KEY");
    const key = requireKey(process.env, "autumn", "metering");

    const response = await postJson<{ id?: string }>(
      `${ENDPOINTS.autumn.base}${ENDPOINTS.autumn.events}`,
      buildTrackRequest({
        customerId: args.customerId,
        featureId: args.featureId,
        units: args.units,
        idempotencyKey: args.idempotencyKey,
      }),
      { token: key }
    );

    if (!response.ok) return { sent: false, error: `${response.status} ${response.error}`, retryable: true };
    return { sent: true, meterEventId: response.data?.id ?? null };
  },
});
