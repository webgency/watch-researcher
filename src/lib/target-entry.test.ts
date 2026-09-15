import { describe, expect, it } from "vitest";
import { parseTargetFields, targetRevision } from "./target-entry";

describe("inline target fields", () => {
  it("accepts a positive amount and normalizes the currency code", () => {
    expect(parseTargetFields({ amount: " 700 ", currency: "eur" })).toEqual({ ok: true, target: { amount: 700, currency: "EUR" } });
  });
  it("rejects a blank amount instead of treating it as clearing the target", () => {
    const result = parseTargetFields({ amount: "", currency: "USD" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.amount).toBeDefined();
  });
  it("rejects zero, negative and non-numeric amounts and unknown currencies", () => {
    for (const amount of ["0", "-5", "abc"]) expect(parseTargetFields({ amount, currency: "USD" }).ok).toBe(false);
    const result = parseTargetFields({ amount: "700", currency: "XYZ" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.currency).toBeDefined();
  });
  it("gives an absent target a revision distinct from any set one", () => {
    expect(targetRevision()).not.toBe(targetRevision({ amount: 700, currency: "USD" }));
    expect(targetRevision({ amount: 700, currency: "USD" })).not.toBe(targetRevision({ amount: 700, currency: "EUR" }));
  });
});
