#!/usr/bin/env node
// One-off: set *estimated* prices for the watches whose retailers block the
// scraper (bot protection or JS-rendered prices, so enrich-watches.mjs can't
// read them). These are best-known retail figures — correct any value below,
// or just edit data/watches.json directly, anytime.
//
// Safe to re-run: it skips any watch that already has a price.
//
// Usage: node scripts/backfill-prices.mjs

import { readFile, writeFile } from "node:fs/promises";

const DATA_URL = new URL("../data/watches.json", import.meta.url);

// Matched by a substring of "Brand Model" (case-insensitive).
const ESTIMATES = [
  { match: "Certina DS-1", amount: 795, currency: "USD" },
  { match: "Christopher Ward C60", amount: 1495, currency: "USD" },
  { match: "Tudor Black Bay 58 GMT", amount: 4375, currency: "USD" },
  { match: "Laventure Automobile", amount: 4200, currency: "USD" },
  { match: "Echo/Neutra Rivanera", amount: 850, currency: "USD" },
  { match: "Baltic Heures du Monde", amount: 845, currency: "EUR" },
  { match: "Baltic Scalegraph", amount: 525, currency: "EUR" },
  { match: "Baltic Aquascaphe GMT", amount: 750, currency: "EUR" },
];

const watches = JSON.parse(await readFile(DATA_URL, "utf8"));
const now = new Date().toISOString();
let n = 0;

for (const est of ESTIMATES) {
  const needle = est.match.toLowerCase();
  const w = watches.find((x) => `${x.brand} ${x.model}`.toLowerCase().includes(needle));
  if (!w) { console.log(`? no match for "${est.match}"`); continue; }
  if (w.price) { console.log(`· ${w.brand} ${w.model} already priced — skipping`); continue; }
  w.price = { amount: est.amount, currency: est.currency };
  w.priceUpdatedAt = now;
  n++;
  console.log(`✓ ${w.brand} ${w.model} → ${est.amount} ${est.currency} (estimate)`);
}

await writeFile(DATA_URL, JSON.stringify(watches, null, 2) + "\n");
console.log(`\nSet ${n} estimated price(s). Review with: git diff data/watches.json`);
