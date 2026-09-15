import { describe, expect, it } from "vitest";
import { parseSoldCompFields, soldCompRevision } from "./sold-comp-entry";

const now = new Date(2026, 8, 14, 18);
const valid = { amount: "5200", currency: "usd", condition: "pre-owned", soldAt: "2026-09-01", source: " Forum ", url: "", notes: "" };

describe("inline sold comp fields", () => {
  it("builds a sale dated at noon UTC with optional fields left out", () => {
    expect(parseSoldCompFields(valid, now)).toEqual({
      ok: true,
      comp: { price: { amount: 5200, currency: "USD" }, condition: "pre-owned", soldAt: "2026-09-01T12:00:00.000Z", source: "Forum" },
    });
  });
  it("reports every missing required field beside its input", () => {
    const result = parseSoldCompFields({ amount: "", currency: "USD", condition: "", soldAt: "", source: "", url: "", notes: "" }, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["amount", "condition", "soldAt", "source"]);
  });
  it("rejects a future sale date and a non-http link", () => {
    const result = parseSoldCompFields({ ...valid, soldAt: "2026-09-20", url: "ftp://example.com" }, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.soldAt).toContain("future");
      expect(result.errors.url).toBeDefined();
    }
  });
  it("keeps a link and notes when given", () => {
    const result = parseSoldCompFields({ ...valid, url: "https://forum.example/t/1", notes: "full set" }, now);
    expect(result).toMatchObject({ ok: true, comp: { url: "https://forum.example/t/1", notes: "full set" } });
  });
  it("gives different sales different revisions", () => {
    const comp = { price: { amount: 5200, currency: "USD" }, condition: "pre-owned" as const, soldAt: "2026-09-01T12:00:00.000Z", source: "Forum" };
    expect(soldCompRevision(comp)).not.toBe(soldCompRevision({ ...comp, notes: "box only" }));
  });
});
