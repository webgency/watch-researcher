import { describe, expect, it } from "vitest";

import { extractSpecs, primaryProductText } from "./scrape";

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
