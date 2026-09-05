import { describe, expect, it } from "vitest";
import { CURRENCY_TO_USD } from "./scoring";
import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("leaves USD prices concise", () => {
    expect(formatMoney({ amount: 425, currency: "USD" })).toBe("$425");
  });

  it("shows USD first and preserves the original retailer currency", () => {
    const expectedUsd = Math.round(550 * CURRENCY_TO_USD.EUR).toLocaleString("en-US");
    expect(formatMoney({ amount: 550, currency: "EUR" })).toBe(`$${expectedUsd} (€550)`);
  });

  it("normalizes currency-code casing", () => {
    expect(formatMoney({ amount: 100, currency: " usd " })).toBe("$100");
  });
});
