import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { ENDPOINTS } from "./endpoints";
import { postJson } from "./http";
import { NotConfigured, has, requireKey } from "../lib/config";

/**
 * Adapter: place the call.
 *
 * The assistant is not given a free hand. Its only route to stating a number is
 * the read_source tool, which lands on our HTTP hook, reads the page now and
 * stores the evidence before the value is spoken. Every call is filed against a
 * case by reference, so a transcript can never arrive attached to nothing.
 */
export const ASSISTANT_TOOLS = [
  {
    type: "function",
    function: {
      name: "read_source",
      description:
        "Read the business's own page or portal for a specific value (price, policy, delivery " +
        "status) before stating it. Returns the value and the time it was read.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The page to read" },
          kind: { type: "string", description: "payment_record | page_fetch | portal_read" },
        },
        required: ["url", "kind"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "file_promise",
      description:
        "Record a commitment made on this call so it can be re-checked later. Never promise " +
        "anything the business's own pages contradict.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          by_when: { type: "string", description: "ISO date the promise is due" },
        },
        required: ["text"],
      },
    },
  },
] as const;

export function buildCallRequest(input: {
  assistantId: string;
  phoneNumberId: string;
  customerNumber: string;
  caseRef: string;
  serverUrl: string;
}) {
  return {
    assistantId: input.assistantId,
    phoneNumberId: input.phoneNumberId,
    customer: { number: input.customerNumber },
    metadata: { caseRef: input.caseRef },
    serverUrl: input.serverUrl,
  };
}

export function buildAssistantConfig(input: { businessName: string; serverUrl: string }) {
  return {
    name: `${input.businessName} line`,
    firstMessage: `Thanks for calling ${input.businessName}. What can I help you with?`,
    serverUrl: input.serverUrl,
    model: { provider: "openai", model: "gpt-4o-mini", tools: ASSISTANT_TOOLS },
    systemPrompt:
      "You handle one customer's problem. Before you state any price, date, policy or status, " +
      "call read_source and use the value it returns. If read_source fails, say you cannot " +
      "confirm it yet. Never promise something the business's own pages contradict. When you " +
      "make a commitment, call file_promise so it can be checked later.",
  };
}

export type CallPlaced = { callRef: string | null; status: string };

export const startCall = internalAction({
  args: {
    assistantId: v.string(),
    phoneNumberId: v.string(),
    customerNumber: v.string(),
    caseRef: v.string(),
    serverUrl: v.string(),
  },
  handler: async (_ctx: ActionCtx, args): Promise<CallPlaced> => {
    if (!has(process.env, "vapi")) throw new NotConfigured("telephony", "VAPI_API_KEY");
    const key = requireKey(process.env, "vapi", "telephony");

    const response = await postJson<{ id?: string; status?: string }>(
      `${ENDPOINTS.vapi.base}${ENDPOINTS.vapi.call}`,
      buildCallRequest(args),
      { token: key }
    );
    if (!response.ok) throw new Error(`the call was not placed: ${response.status} ${response.error}`);
    return { callRef: response.data?.id ?? null, status: response.data?.status ?? "unknown" };
  },
});
