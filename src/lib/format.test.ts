import { describe, expect, it } from "vitest";
import { CURRENCY_TO_USD } from "./scoring";
import { formatMoney, formatOrdinal } from "./format";

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

describe("formatOrdinal", () => {
  it("uses st/nd/rd for 1, 2 and 3", () => {
    expect([1, 2, 3, 4].map(formatOrdinal)).toEqual(["1st", "2nd", "3rd", "4th"]);
  });

  it("keeps the teens on th", () => {
    expect([11, 12, 13].map(formatOrdinal)).toEqual(["11th", "12th", "13th"]);
  });

  it("reads the last digit past the teens", () => {
    expect([21, 22, 23, 78, 100, 101, 111].map(formatOrdinal)).toEqual([
      "21st",
      "22nd",
      "23rd",
      "78th",
      "100th",
      "101st",
      "111th",
    ]);
  });

  it("rounds fractional percentiles before picking a suffix", () => {
    expect(formatOrdinal(21.6)).toBe("22nd");
  });
});
