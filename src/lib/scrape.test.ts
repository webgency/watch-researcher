import { describe, expect, it } from "vitest";

import {
  extractSpecs,
  extractQualityFlags,
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

  it("prefers a bounded technical section over a sparse Shopify description", () => {
    const body = "A handsome automatic watch.";
    const renderedPage = `
      <main>
        Size guide: 36mm quartz chronograph GMT
        <section>Technical Details — Japan Miyota 9015 — 42 hour power reserve — 20 ATM</section>
        <section>Customers Also Love: 44mm solar GMT</section>
      </main>`;

    const text = productExtractionText(body, renderedPage);

    expect(text).toContain("Miyota 9015");
    expect(text).not.toContain("36mm quartz chronograph GMT");
    expect(text).not.toContain("44mm solar GMT");
  });

  it("allows a collection page only when it has a bounded specification section", () => {
    const withSpecs = `<main>Other model: GMT Specifications DIAMETER 38mm MOVEMENT La Joux Perret G100 Our Collections GMT</main>`;
    const withoutSpecs = `<main>Product one: quartz. Product two: automatic GMT.</main>`;

    expect(productExtractionText(undefined, withSpecs, true)).toBe("Specifications DIAMETER 38mm MOVEMENT La Joux Perret G100");
    expect(productExtractionText(undefined, withoutSpecs, true)).toBe("");
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

  it("reads standalone caliber names and written-out reserve units", () => {
    expect(extractSpecs("Automatic — Japan Miyota 9015 — 42 hour power reserve")).toMatchObject({
      movement: "automatic",
      caliber: "Miyota 9015",
      powerReserveHours: 42,
    });
    expect(extractSpecs("MOVEMENT La Joux Perret G100 Automatic POWER RESERVE ~68 hours")).toMatchObject({
      movement: "automatic",
      caliber: "La Joux Perret G100",
      powerReserveHours: 68,
    });
    expect(extractSpecs("Depth 12.5mm. The case measures 11.9mm in height and 46mm from lug to lug.")).toMatchObject({
      caseThicknessMm: 12.5,
      lugToLugMm: 46,
    });
  });

  it("prefers an explicit maker and caliber over nearby calibre prose", () => {
    expect(extractSpecs("Sellita SW330-2 automatic movement. This dependable calibre beats at a smooth rate of 28,800 bph.").caliber)
      .toBe("Sellita SW330-2");
  });
});

describe("extractQualityFlags", () => {
  it("captures explicit scoring evidence without guessing absent features", () => {
    expect(extractQualityFlags(
      "Adjusted for accuracy in 5 positions. Sapphire bezel insert. Lug holes. " +
      "Internal anti-reflective coating. Quick-release end links and on-the-fly micro-adjust. +/-5 spd.",
      "7-Link Bracelet"
    )).toEqual({
      regulatedPositions: 5,
      accuracySpecSpd: 5,
      sapphireBezelInsert: true,
      drilledLugs: true,
      arCoated: true,
      microAdjustClasp: true,
      quickRelease: true,
      braceletIncluded: true,
    });
  });

  it("marks an explicitly selected strap as no bracelet", () => {
    expect(extractQualityFlags("Sapphire crystal", "FKM Dive Strap")).toEqual({ braceletIncluded: false });
  });

  it("recognizes a page that explicitly says the measured watch includes its bracelet", () => {
    expect(extractQualityFlags("Weight: 160g including bracelet")).toEqual({ braceletIncluded: true });
  });
});
