import { describe, expect, it } from "vitest";
import { recordOfferObservation } from "./offer-observation.mjs";

describe("recordOfferObservation", () => {
  it("records the scraped ask and timestamp on its source link", () => {
    const link: { price?: { amount: number; currency: string }; observedAt?: string } = {};

    expect(
      recordOfferObservation(
        link,
        { amount: 725, currency: "USD" },
        "2026-09-10T14:00:00.000Z",
      ),
    ).toBe("updated");
    expect(link).toEqual({
      price: { amount: 725, currency: "USD" },
      observedAt: "2026-09-10T14:00:00.000Z",
    });
  });

  it("advances freshness when the same ask is confirmed again", () => {
    const link = {
      price: { amount: 725, currency: "USD" },
      observedAt: "2026-08-01T14:00:00.000Z",
    };

    recordOfferObservation(
      link,
      { amount: 725, currency: "USD" },
      "2026-09-10T14:00:00.000Z",
    );

    expect(link.observedAt).toBe("2026-09-10T14:00:00.000Z");
  });

  it("stores the page's native currency instead of preserving an old conversion", () => {
    const link = {
      price: { amount: 725, currency: "USD" },
      observedAt: "2026-08-01T14:00:00.000Z",
    };

    expect(
      recordOfferObservation(
        link,
        { amount: 650, currency: "EUR" },
        "2026-09-10T14:00:00.000Z",
      ),
    ).toBe("currency-updated");
    expect(link).toEqual({
      price: { amount: 650, currency: "EUR" },
      observedAt: "2026-09-10T14:00:00.000Z",
    });
  });

  it("fills a known condition without overwriting a recorded one", () => {
    const link = {
      price: { amount: 725, currency: "USD" },
      observedAt: "2026-08-01T14:00:00.000Z",
      condition: "pre-owned" as const,
    };

    recordOfferObservation(
      link,
      { amount: 725, currency: "USD" },
      "2026-09-10T14:00:00.000Z",
      { condition: "new" },
    );
    expect(link.condition).toBe("pre-owned");

    const untagged: { condition?: "new" | "pre-owned" } = {};
    recordOfferObservation(
      untagged,
      { amount: 725, currency: "USD" },
      "2026-09-10T14:00:00.000Z",
      { condition: "new" },
    );
    expect(untagged.condition).toBe("new");
  });
});
