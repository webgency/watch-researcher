import { describe, expect, it } from "vitest";

import {
  extractSpecs,
  isShopifyCollectionUrl,
  primaryProductText,
  productExtractionText,
  selectShopifyVariant,
  shopifyProductJsonUrl,
} from "./scrape";

const SPINNAKER_STYLE_PAGE = `
  <header>
    Related: 39mm quartz chronograph GMT
  </header>
  <main id="MainContent">
    <section class="size-guide">Find Your Case Diameter 39mm 40-42mm 43-45mm</section>
    <h1>Croft Mid-Size Automatic - Dolphin Project Limited Edition</h1>
    <section>
      <h2>Specification</h2>
      Movement: Japanese Automatic With 3 Hands Date
      Case Material: Stainless Steel
      Case Size (mm): 40.0
      Case Thickness (mm): 14.1
      Lug to Lug (mm): 47.0
      Dial Colour: Green
      Lens: Anti Reflection Coated Sapphire Lens
      Band: 20mm Stainless Steel With Fold Over Buckle
      Extra Band: Grey RPET Strap
      Water Resistance: 15 ATM
      Instruction Manual
      <h3>Miyota 8215 Automatic Movement</h3>
      42 Hours Power Reserve
      Designed for the avid diver and adventurer.
    </section>
    <section><h2>FAQs</h2>Other watches use quartz and GMT movements.</section>
  </main>
  <footer>Chronograph collection</footer>
`;

describe("primaryProductText", () => {
  it("isolates the specification area from navigation, size guides, related products, and FAQs", () => {
    const text = primaryProductText(SPINNAKER_STYLE_PAGE);

    expect(text).toContain("Case Size (mm): 40.0");
    expect(text).toContain("Miyota 8215 Automatic Movement");
    expect(text).not.toContain("Find Your Case Diameter");
    expect(text).not.toContain("Other watches use quartz");
    expect(text).not.toContain("Chronograph collection");
  });
});

describe("productExtractionText", () => {
  it("does not mix a Shopify product description with unrelated rendered-page specs", () => {
    const body = "D5 Pacific. 39mm automatic movement. 20 ATM water resistance.";
    const renderedPage = `<main>${body}<section>Related: 36mm quartz chronograph GMT</section></main>`;

    const text = productExtractionText(body, renderedPage);

    expect(text).toContain("39mm automatic");
    expect(text).not.toContain("36mm quartz chronograph GMT");
  });
});

describe("selectShopifyVariant", () => {
  const variants = [
    { id: 100, available: true, sku: "FIRST", price: "749.00" },
    { id: 200, available: true, sku: "REQUESTED", price: "839.00" },
  ];

  it("honors the variant in the product URL", () => {
    expect(selectShopifyVariant("https://example.com/products/watch?variant=200", variants)?.sku).toBe("REQUESTED");
  });

  it("falls back to the first available variant", () => {
    expect(selectShopifyVariant("https://example.com/products/watch", variants)?.sku).toBe("FIRST");
  });
});

describe("Shopify URL classification", () => {
  it("supports localized product paths", () => {
    expect(shopifyProductJsonUrl("https://example.com/en-us/products/hudson?variant=200"))
      .toBe("https://example.com/en-us/products/hudson.json");
  });

  it("distinguishes collection landing pages from product URLs", () => {
    expect(isShopifyCollectionUrl("https://example.com/en-us/collections/hudson-38-mk5")).toBe(true);
    expect(isShopifyCollectionUrl("https://example.com/collections/divers/products/hudson")).toBe(false);
  });
});

describe("extractSpecs", () => {
  it("reads labeled Shopify specs without taking nearby values from other fields", () => {
    const specs = extractSpecs(primaryProductText(SPINNAKER_STYLE_PAGE));

    expect(specs).toMatchObject({
      caseDiameterMm: 40,
      caseThicknessMm: 14.1,
      lugToLugMm: 47,
      lugWidthMm: 20,
      caseMaterial: "Stainless Steel",
      movement: "automatic",
      caliber: "Miyota 8215",
      powerReserveHours: 42,
      waterResistanceM: 150,
      crystal: "Sapphire",
      dialColor: "Green",
      braceletStrap: "20mm Stainless Steel With Fold Over Buckle",
    });
    expect(specs.complications).toBeUndefined();
  });
});
