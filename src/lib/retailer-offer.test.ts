import { describe, expect, it } from "vitest";
import {
  conditionFromValue,
  extractRetailOffer,
  inferRetailCondition,
  isBrandRetailUrl,
  offerFailure,
  parseRetailMoney,
} from "./retailer-offer.mjs";

describe("retailer offer extraction", () => {
  it("reads a matching JSON-LD Product offer and explicit condition", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@graph": [{
        "@type": "Product",
        url: "https://shop.example/products/watch",
        offers: {
          "@type": "Offer",
          price: "729.00",
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
        },
      }],
    })}</script>`;

    expect(extractRetailOffer(html, "https://shop.example/products/watch")).toEqual({
      price: { amount: 729, currency: "USD" },
      condition: "new",
      source: "json-ld",
    });
  });

  it("reads conventional price and condition meta tags", () => {
    const html = `
      <meta property="product:price:amount" content="1,149.00">
      <meta property="product:price:currency" content="USD">
      <meta property="product:condition" content="used">
    `;

    expect(extractRetailOffer(html, "https://dealer.example/watch")).toEqual({
      price: { amount: 1149, currency: "USD" },
      condition: "pre-owned",
      source: "price-meta",
    });
  });

  it("reads Baltic-style escaped commerce data for the requested product only", () => {
    const html = String.raw`
      {\"handle\":\"related-strap\",\"priceRange\":{\"minVariantPrice\":{\"amount\":\"45.0\",\"currencyCode\":\"EUR\"}}},
      {\"id\":\"gid://shopify/Product/1\",\"title\":\"Aquascaphe MK2 - Blue\",\"handle\":\"aquascaphe-mk2-blue\",\"variants\":{\"nodes\":[]},\"priceRange\":{\"minVariantPrice\":{\"amount\":\"630.0\",\"currencyCode\":\"EUR\"},\"maxVariantPrice\":{\"amount\":\"740.0\",\"currencyCode\":\"EUR\"}}}
    `;

    expect(extractRetailOffer(html, "https://baltic-watches.com/en/products/aquascaphe-mk2-blue")).toEqual({
      price: { amount: 630, currency: "EUR" },
      condition: undefined,
      source: "embedded-commerce",
    });
  });

  it("uses an exact requested variant before a product range", () => {
    const html = String.raw`
      {\"handle\":\"aquascaphe-mk2-blue\",\"variants\":{\"nodes\":[
        {\"id\":\"gid://shopify/ProductVariant/100\",\"price\":{\"amount\":\"630.0\",\"currencyCode\":\"EUR\"}},
        {\"id\":\"gid://shopify/ProductVariant/200\",\"price\":{\"amount\":\"695.0\",\"currencyCode\":\"EUR\"}}
      ]},\"priceRange\":{\"minVariantPrice\":{\"amount\":\"630.0\",\"currencyCode\":\"EUR\"}}}
    `;

    const offer = extractRetailOffer(
      html,
      "https://baltic-watches.com/en/products/aquascaphe-mk2-blue?variant=200",
    );
    expect(offer?.price).toEqual({ amount: 695, currency: "EUR" });
  });

  it("reads the current Maen-style collection analytics price", () => {
    const html = String.raw`
      events=\"[[\"collection_viewed\",{\"collection\":{\"id\":\"1\",\"title\":\"HUDSON 38 MK5\",\"productVariants\":[{\"price\":{\"amount\":852.0,\"currencyCode\":\"USD\"},\"product\":{\"title\":\"HUDSON 38 MK5 - M1.1.5\"}}]}}]]\"
    `;

    expect(extractRetailOffer(
      html,
      "https://www.maenwatches.com/en-us/collections/hudson-38-mk5",
    )?.price).toEqual({ amount: 852, currency: "USD" });
  });

  it("does not take an unrelated embedded product price", () => {
    const html = String.raw`
      {\"handle\":\"another-watch\",\"priceRange\":{\"minVariantPrice\":{\"amount\":\"100.0\",\"currencyCode\":\"USD\"}}}
    `;
    expect(extractRetailOffer(html, "https://brand.example/products/requested-watch")).toBeUndefined();
  });
});

describe("retailer condition inference", () => {
  it("recognizes schema condition values", () => {
    expect(conditionFromValue("https://schema.org/NewCondition")).toBe("new");
    expect(conditionFromValue("https://schema.org/UsedCondition")).toBe("pre-owned");
    expect(conditionFromValue("unknown")).toBeUndefined();
  });

  it("classifies only a matching manufacturer hostname as new retail", () => {
    expect(isBrandRetailUrl("https://www.vaerwatches.com/products/d5", "Vaer Watches")).toBe(true);
    expect(isBrandRetailUrl("https://www.jackmasonbrand.com/products/gmt", "Jack Mason")).toBe(true);
    expect(isBrandRetailUrl("https://market.example/vaer-d5", "Vaer Watches")).toBe(false);
    expect(inferRetailCondition({ url: "https://Sorrel.example/vaer-d5", brand: "Vaer Watches" })).toBeUndefined();
  });

  it("lets explicit and pre-owned path evidence override brand retail", () => {
    expect(inferRetailCondition({
      url: "https://brand.example/products/watch",
      brand: "Brand",
      explicitCondition: "https://schema.org/UsedCondition",
    })).toBe("pre-owned");
    expect(inferRetailCondition({
      url: "https://brand.example/certified-pre-owned/watch",
      brand: "Brand",
    })).toBe("pre-owned");
  });

  it("labels the shortlist manufacturer links as new", () => {
    expect(inferRetailCondition({ url: "https://baltic-watches.com/en/products/aquascaphe", brand: "Baltic" })).toBe("new");
    expect(inferRetailCondition({ url: "https://maenwatches.com/collections/hudson", brand: "Maen" })).toBe("new");
    expect(inferRetailCondition({ url: "https://farer.com/products/nevada", brand: "Farer" })).toBe("new");
  });
});

describe("retailer offer safeguards", () => {
  it("does not invent a currency", () => {
    expect(parseRetailMoney("729.00")).toBeUndefined();
    expect(parseRetailMoney("729.00", "USD")).toEqual({ amount: 729, currency: "USD" });
  });

  it("returns a structured collection failure", () => {
    expect(offerFailure("https://shop.example/collections/hudson")).toMatchObject({
      code: "no-unambiguous-collection-price",
    });
  });
});
