import { describe, expect, it } from "vitest";
import { KEYS, NotConfigured, configured, has, requireKey } from "../convex/lib/config";
import { buildScrapeRequest } from "../convex/integrations/firecrawl";
import { buildTrackRequest } from "../convex/integrations/autumn";
import { EXTRACTION_SCHEMA, buildExtractionRequest } from "../convex/integrations/openai";
import { buildTestCaseRequest, type GradingBundle } from "../convex/integrations/scorecard";
import { buildEmailRequest } from "../convex/integrations/resend";
import { ASSISTANT_TOOLS, buildAssistantConfig, buildCallRequest } from "../convex/integrations/vapi";
import { buildChatRequest } from "../convex/integrations/inkeep";

describe("an unconfigured integration is absent, not approximated", () => {
  it("reports nothing as configured when nothing is set", () => {
    const health = configured({});
    expect(health.convex).toBe(true);
    for (const [name, value] of Object.entries(health)) {
      if (name === "convex") continue;
      expect(value, `${name} must not claim to be configured`).toBe(false);
    }
  });

  it("treats an empty or whitespace value as missing", () => {
    expect(has({ FIRECRAWL_API_KEY: "" }, "firecrawl")).toBe(false);
    expect(has({ FIRECRAWL_API_KEY: "   " }, "firecrawl")).toBe(false);
    expect(has({ FIRECRAWL_API_KEY: "fc-abc" }, "firecrawl")).toBe(true);
  });

  it("names the exact variable that is missing", () => {
    try {
      requireKey({}, "autumn", "metering");
      throw new Error("expected a refusal");
    } catch (error) {
      expect(error).toBeInstanceOf(NotConfigured);
      const refusal = error as NotConfigured;
      expect(refusal.variable).toBe(KEYS.autumn);
      expect(refusal.message).toContain("AUTUMN_SECRET_KEY");
    }
  });
});

describe("what we send to each vendor", () => {
  it("asks the crawler for the page itself, not a summary of it", () => {
    const request = buildScrapeRequest("https://example.com/orders/12345");
    expect(request.url).toBe("https://example.com/orders/12345");
    expect(request.formats).toContain("markdown");
    expect(request.onlyMainContent).toBe(true);
  });

  it("meters one unit under the caller's own idempotency key", () => {
    const request = buildTrackRequest({
      customerId: "cust-1",
      featureId: "verified_resolution",
      units: 1,
      idempotencyKey: "call:abc",
    });
    expect(request.idempotency_key).toBe("call:abc");
    expect(request.value).toBe(1);
    expect(request.customer_id).toBe("cust-1");
  });

  it("asks the model for claims, at zero temperature, in a fixed shape", () => {
    const request = buildExtractionRequest("agent: your refund was issued");
    expect(request.temperature).toBe(0);
    expect(request.response_format).toBe(EXTRACTION_SCHEMA);
    const schema = EXTRACTION_SCHEMA.json_schema.schema as unknown as {
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(schema.required).toEqual(["caller_wanted", "resolved", "promises", "facts"]);
    expect(Object.keys(schema.properties)).not.toContain("true");
    // The model is never asked for a verdict: it reports claims, evidence decides.
    expect(JSON.stringify(EXTRACTION_SCHEMA)).not.toMatch(/verdict|is_true|guilty/);
  });

  it("sends the grader the evidence, not just our opinion", () => {
    const bundle: GradingBundle = {
      caseRef: "case-1",
      callRef: "call-1",
      transcriptExcerpt: "agent: 41.20 was refunded",
      claims: [{ kind: "fact", text: "refunded 41.20", verdict: "unverifiable" }],
      evidence: [{ kind: "payment_record", sourceKind: "counterparty", source: "https://example.com", excerpt: "refund 41.20" }],
    };
    const request = buildTestCaseRequest(bundle);
    expect(request.metadata).toEqual({ caseRef: "case-1", callRef: "call-1" });
    const input = request.input as { claims: unknown[]; evidence: unknown[] };
    expect(input.claims).toHaveLength(1);
    expect(input.evidence).toHaveLength(1);
  });

  it("composes an email with one recipient and the caller's own text", () => {
    expect(buildEmailRequest({ from: "cases@bailiff.app", to: "owner@example.com", subject: "s", text: "t" })).toEqual({
      from: "cases@bailiff.app",
      to: ["owner@example.com"],
      subject: "s",
      text: "t",
    });
  });

  it("files the call against a case by reference", () => {
    const request = buildCallRequest({
      assistantId: "asst-1",
      phoneNumberId: "pn-1",
      customerNumber: "+15550000001",
      caseRef: "case-9",
      serverUrl: "https://example.convex.site/hooks/vapi-tools",
    });
    expect(request.metadata.caseRef).toBe("case-9");
    expect(request.serverUrl).toContain("/hooks/vapi-tools");
  });

  it("gives the assistant no route to a number except a recorded read", () => {
    const config = buildAssistantConfig({ businessName: "Example Corp", serverUrl: "https://x.convex.site" });
    const names = config.model.tools.map((t) => t.function.name);
    expect(names).toContain("read_source");
    expect(names).toContain("file_promise");
    expect(config.systemPrompt).toMatch(/call read_source/);
    expect(config.systemPrompt).toMatch(/If read_source fails/);
    expect(ASSISTANT_TOOLS).toHaveLength(2);
  });

  it("asks the knowledge layer to answer from the context or not at all", () => {
    const request = buildChatRequest("when will it arrive?", ["Delivery takes 3 days."]);
    expect(request.temperature).toBe(0);
    expect(request.messages[1].content).toContain("Delivery takes 3 days.");
    expect(request.messages[0].content).toMatch(/only from the supplied context/);
    expect(request.messages[0].content).toMatch(/do not guess/);
  });
});
