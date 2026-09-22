import { describe, expect, it } from "vitest";
import { buildSendRequest, parseInbound } from "../convex/integrations/agentmail";
import { emailPath, configured } from "../convex/lib/config";
import { extractCaseRef } from "../convex/http";

/**
 * The mailbox is chosen for a reason, and these tests pin that reason: the path
 * that can receive is preferred, because a case needs the reply back as evidence.
 */
describe("choosing the mail path", () => {
  it("prefers the mailbox that can also receive", () => {
    expect(
      emailPath({ AGENTMAIL_API_KEY: "k", AGENTMAIL_INBOX_ID: "cases@inbox", RESEND_API_KEY: "r", RESEND_FROM: "a@b.c" })
    ).toBe("agentmail");
  });

  it("falls back to the one-way sender when there is a verified from-address", () => {
    expect(emailPath({ RESEND_API_KEY: "r", RESEND_FROM: "cases@example.com" })).toBe("resend");
  });

  it("refuses a sender with no from-address, because it cannot send anything", () => {
    expect(emailPath({ RESEND_API_KEY: "r" })).toBeNull();
  });

  it("refuses a mailbox with no inbox, because there is nowhere to send from", () => {
    expect(emailPath({ AGENTMAIL_API_KEY: "k" })).toBeNull();
  });

  it("says nothing is configured when nothing is configured", () => {
    expect(emailPath({})).toBeNull();
  });

  it("reports the receive capability honestly in the health map", () => {
    const withMailbox = configured({ AGENTMAIL_API_KEY: "k", AGENTMAIL_INBOX_ID: "i" });
    expect(withMailbox.email).toBe(true);
    expect(withMailbox.mailReceives).toBe(true);
    const withSender = configured({ RESEND_API_KEY: "r", RESEND_FROM: "a@b.c" });
    expect(withSender.email).toBe(true);
    expect(withSender.mailReceives).toBe(false);
    expect(configured({}).email).toBe(false);
  });

  it("counts either webhook secret as a working hook configuration", () => {
    expect(configured({ VAPI_WEBHOOK_SECRET: "v", AGENTMAIL_WEBHOOK_SECRET: "a" }).hooks).toBe(true);
    expect(configured({ VAPI_WEBHOOK_SECRET: "v" }).hooks).toBe(false);
  });
});

describe("what we send", () => {
  it("addresses one recipient by name", () => {
    const request = buildSendRequest({ to: "owner@example.com", subject: "s", text: "t" });
    expect(request.to).toEqual(["owner@example.com"]);
    expect(request.subject).toBe("s");
    expect(request.text).toBe("t");
  });
});

describe("reading a reply", () => {
  it("takes the sender, subject and body from a wrapped message", () => {
    const reply = parseInbound({
      message: { from: "support@example.com", subject: "Re: your case [case:c-1]", text: "we have issued it" },
    });
    expect(reply?.from).toBe("support@example.com");
    expect(reply?.text).toBe("we have issued it");
  });

  it("accepts an address object", () => {
    const reply = parseInbound({ message: { from: { address: "billing@example.com" }, subject: "s", text: "ok" } });
    expect(reply?.from).toBe("billing@example.com");
  });

  it("accepts an unwrapped payload", () => {
    expect(parseInbound({ from: "a@b.c", subject: "s", text: "hello" })?.from).toBe("a@b.c");
  });

  it("uses extracted text when the body is not plain text", () => {
    const reply = parseInbound({ message: { from: "a@b.c", extracted_text: "html-only body" } });
    expect(reply?.text).toBe("html-only body");
  });

  it("records nothing when there is no readable body", () => {
    expect(parseInbound({ message: { from: "a@b.c", text: "   " } })).toBeNull();
    expect(parseInbound({ message: { text: "no sender" } })).toBeNull();
    expect(parseInbound(null)).toBeNull();
    expect(parseInbound({})).toBeNull();
  });
});

describe("filing a reply against the right case", () => {
  it("reads the reference the outgoing subject carries", () => {
    expect(extractCaseRef("Re: Call not billable (unverified): case-9 [case:case-9]")).toBe("case-9");
  });

  it("finds nothing rather than guessing when the reference is absent", () => {
    expect(extractCaseRef("Re: your enquiry")).toBeNull();
    expect(extractCaseRef("")).toBeNull();
  });

  it("does not accept a reference with punctuation that cannot be a case", () => {
    expect(extractCaseRef("[case:]")).toBeNull();
  });
});
