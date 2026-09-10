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

  it("preserves the prior observation when the site changes currency", () => {
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
    ).toBe("currency");
    expect(link).toEqual({
      price: { amount: 725, currency: "USD" },
      observedAt: "2026-08-01T14:00:00.000Z",
    });
  });

  it("allows an explicit currency change", () => {
    const link = {
      price: { amount: 725, currency: "USD" },
      observedAt: "2026-08-01T14:00:00.000Z",
    };

    expect(
      recordOfferObservation(
        link,
        { amount: 650, currency: "EUR" },
        "2026-09-10T14:00:00.000Z",
        { allowCurrencyChange: true },
      ),
    ).toBe("updated");
    expect(link).toEqual({
      price: { amount: 650, currency: "EUR" },
      observedAt: "2026-09-10T14:00:00.000Z",
    });
  });
});
