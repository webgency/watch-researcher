#!/usr/bin/env node
// Lists mechanical caliber gaps without assigning them a guessed tier.
// Unknown recorded calibers fail the audit; missing calibers remain visible as
// research work but do not fail, because missing data is an honest app state.

import { readFile } from "node:fs/promises";
import { isKnownCaliber, isQuartzCaliber, isQuartzMovement, normalizeCaliber } from "../src/lib/caliber-aliases.mjs";

const raw = JSON.parse(await readFile(new URL("../data/watches.json", import.meta.url), "utf8"));
const watches = Array.isArray(raw) ? raw : raw.watches;
const mechanical = watches.filter((watch) => !isQuartzMovement(watch.specs?.movement));
const recorded = mechanical.filter((watch) => Boolean(watch.specs?.caliber?.trim()));
// A quartz caliber on a watch not recorded as quartz is a data error, not a
// tier gap: fix `movement` and normalizeCaliber() leaves it unrated on purpose.
// Reported apart from unknown calibers so the fix it gets isn't a tier row.
const mislabelledQuartz = recorded.filter((watch) => isQuartzCaliber(watch.specs.caliber));
const unrecognized = recorded.filter(
  (watch) => !isQuartzCaliber(watch.specs.caliber) && !isKnownCaliber(watch.specs.caliber, watch.specs.movement)
);
const missing = mechanical.filter((watch) => !watch.specs?.caliber?.trim());
const label = (watch) => `${watch.brand} ${watch.model} (${watch.id})`;

console.log(`Caliber audit — ${watches.length} watches`);
console.log(`  Recognized recorded mechanical calibers: ${recorded.length - unrecognized.length - mislabelledQuartz.length}/${recorded.length}`);

console.log(`\nQuartz calibers not recorded as quartz movement (${mislabelledQuartz.length})`);
for (const watch of mislabelledQuartz) {
  console.log(`  - ${label(watch)}: ${JSON.stringify(watch.specs.caliber)}, movement ${JSON.stringify(watch.specs.movement ?? null)}`);
}

console.log(`\nUnrecognized recorded calibers (${unrecognized.length})`);
for (const watch of unrecognized) {
  console.log(`  - ${label(watch)}: ${JSON.stringify(normalizeCaliber(watch.specs.caliber, watch.specs.movement))}`);
}

console.log(`\nMissing mechanical calibers (${missing.length}, research needed; not a failure)`);
for (const watch of missing) console.log(`  - ${label(watch)}`);

if (mislabelledQuartz.length) {
  console.error("\nCaliber audit failed: set movement to \"quartz\" on the watches above; quartz stays off the mechanical tier scale.");
}
if (unrecognized.length) {
  console.error("\nCaliber audit failed: add a researched alias/tier or leave the unknown movement unrated deliberately.");
}
if (mislabelledQuartz.length || unrecognized.length) {
  process.exit(1);
}

console.log("\nCaliber audit passed: every recorded mechanical caliber resolves to an explicit tier.");
