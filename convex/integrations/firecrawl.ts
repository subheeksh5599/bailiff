import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { ENDPOINTS } from "./endpoints";
import { postJson } from "./http";
import { NotConfigured, has, requireKey } from "../lib/config";

/**
 * Adapter: read a page with the crawler and hand back exactly what it returned.
 *
 * This module touches no database. It either returns the vendor's content, with
 * the time it was read, or it names the missing key. Writing that read onto a
 * case is the orchestrator's job - which keeps the boundary between "what the
 * vendor said" and "what we recorded" visible in the code.
 */
export function buildScrapeRequest(url: string) {
  return { url, formats: ["markdown"], onlyMainContent: true, timeout: 30_000 };
}

export type ScrapeResponse = {
  success?: boolean;
  data?: {
    markdown?: string;
    metadata?: { title?: string; sourceURL?: string; statusCode?: number };
  };
};

export type PageRead = {
  url: string;
  sourceUrl: string;
  title: string | null;
  markdown: string;
  fetchedAt: number;
  statusCode: number | null;
};

export const readPage = internalAction({
  args: { url: v.string() },
  handler: async (_ctx: ActionCtx, args): Promise<PageRead> => {
    if (!has(process.env, "firecrawl")) throw new NotConfigured("firecrawl", "FIRECRAWL_API_KEY");
    const key = requireKey(process.env, "firecrawl", "firecrawl");

    const response = await postJson<ScrapeResponse>(
      `${ENDPOINTS.firecrawl.base}${ENDPOINTS.firecrawl.scrape}`,
      buildScrapeRequest(args.url),
      { token: key }
    );
    if (!response.ok) {
      throw new Error(`firecrawl refused ${args.url}: ${response.status} ${response.error}`);
    }

    const markdown = response.data?.data?.markdown ?? "";
    if (markdown.trim().length === 0) {
      throw new Error(`firecrawl returned no content for ${args.url}; nothing is stored`);
    }

    return {
      url: args.url,
      sourceUrl: response.data?.data?.metadata?.sourceURL ?? args.url,
      title: response.data?.data?.metadata?.title ?? null,
      markdown,
      fetchedAt: Date.now(),
      statusCode: response.data?.data?.metadata?.statusCode ?? null,
    };
  },
});
