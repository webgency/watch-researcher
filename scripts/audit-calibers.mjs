#!/usr/bin/env node
// Lists mechanical caliber gaps without assigning them a guessed tier.
// Unknown recorded calibers fail the audit; missing calibers remain visible as
// research work but do not fail, because missing data is an honest app state.

import { readFile } from "node:fs/promises";
import { isKnownCaliber, isQuartzMovement, normalizeCaliber } from "../src/lib/caliber-aliases.mjs";

const raw = JSON.parse(await readFile(new URL("../data/watches.json", import.meta.url), "utf8"));
const watches = Array.isArray(raw) ? raw : raw.watches;
const mechanical = watches.filter((watch) => !isQuartzMovement(watch.specs?.movement));
const recorded = mechanical.filter((watch) => Boolean(watch.specs?.caliber?.trim()));
const unrecognized = recorded.filter(
  (watch) => !isKnownCaliber(watch.specs.caliber, watch.specs.movement)
);
const missing = mechanical.filter((watch) => !watch.specs?.caliber?.trim());
const label = (watch) => `${watch.brand} ${watch.model} (${watch.id})`;

console.log(`Caliber audit — ${watches.length} watches`);
console.log(`  Recognized recorded mechanical calibers: ${recorded.length - unrecognized.length}/${recorded.length}`);

console.log(`\nUnrecognized recorded calibers (${unrecognized.length})`);
for (const watch of unrecognized) {
  console.log(`  - ${label(watch)}: ${JSON.stringify(normalizeCaliber(watch.specs.caliber, watch.specs.movement))}`);
}

console.log(`\nMissing mechanical calibers (${missing.length}, research needed; not a failure)`);
for (const watch of missing) console.log(`  - ${label(watch)}`);

if (unrecognized.length) {
  console.error("\nCaliber audit failed: add a researched alias/tier or leave the unknown movement unrated deliberately.");
  process.exit(1);
}

console.log("\nCaliber audit passed: every recorded mechanical caliber resolves to an explicit tier.");
