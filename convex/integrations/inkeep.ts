import { v } from "convex/values";
import { action, type ActionCtx } from "../_generated/server";
import { ENDPOINTS, MODELS } from "./endpoints";
import { postJson } from "./http";
import { NotConfigured, has, requireKey } from "../lib/config";

/**
 * Grounded answers, from the business's own material.
 *
 * This is the mouth of the phone line: the assistant is not left to answer from
 * memory, and it is not asked to be careful. The knowledge layer answers from the
 * documents it holds, and the call transcript records what it said, so a wrong
 * answer is a fact on the record rather than a matter of opinion.
 */
export function buildChatRequest(question: string, context: string[]) {
  return {
    model: MODELS.inkeep,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Answer only from the supplied context. If the context does not contain the answer, " +
          "say that plainly and do not guess a number, a date or a policy.",
      },
      {
        role: "user",
        content: `Context:\n${context.join("\n---\n")}\n\nQuestion: ${question}`,
      },
    ],
  };
}

type ChatResponse = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
};

export const answer = action({
  args: {
    question: v.string(),
    context: v.array(v.string()),
  },
  handler: async (_ctx: ActionCtx, args) => {
    if (!has(process.env, "inkeep")) throw new NotConfigured("knowledge", "INKEEP_API_KEY");
    const key = requireKey(process.env, "inkeep", "knowledge");

    const response = await postJson<ChatResponse>(
      `${ENDPOINTS.inkeep.base}${ENDPOINTS.inkeep.chat}`,
      buildChatRequest(args.question, args.context),
      { token: key }
    );
    if (!response.ok) {
      throw new Error(`knowledge layer refused: ${response.status} ${response.error}`);
    }
    const content = response.data?.choices?.[0]?.message?.content ?? "";
    return { answer: content, contextDocuments: args.context.length };
  },
});
