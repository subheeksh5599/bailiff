import { describe, expect, it } from "vitest";
import { canonicalJson, requirementSetHash, sha256Hex } from "../convex/lib/hash";

describe("content hashing", () => {
  it("matches the known SHA-256 of the empty string", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("matches the known SHA-256 of abc", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});

describe("canonical form", () => {
  it("does not depend on key order", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it("drops undefined so an omitted optional is not a different document", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });

  it("keeps array order, because array order is meaning", () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});

describe("the frozen requirement set is identified by its content", () => {
  it("gives the same hash whatever order the requirements arrive in", async () => {
    const a = await requirementSetHash([
      { key: "refund_issued", kind: "payment_record" },
      { key: "order_ref", kind: "email_reply" },
    ]);
    const b = await requirementSetHash([
      { key: "order_ref", kind: "email_reply" },
      { key: "refund_issued", kind: "payment_record" },
    ]);
    expect(a).toBe(b);
  });

  it("gives a different hash when the set actually differs, so a moved goalpost is visible", async () => {
    const a = await requirementSetHash([{ key: "refund_issued", kind: "payment_record" }]);
    const b = await requirementSetHash([{ key: "refund_issued", kind: "payment_record" }, { key: "order_ref", kind: "email_reply" }]);
    expect(a).not.toBe(b);
  });
});
