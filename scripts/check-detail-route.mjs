// Run against `npm start` after a production build. A successful build alone
// missed the on-demand static rendering failure that returned 500 for watch ids.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const watches = JSON.parse(await readFile(new URL("../data/watches.json", import.meta.url), "utf8"));
assert(watches.length > 0, "The detail-route check needs at least one watch.");
for (const id of new Set([watches[0].id, watches.at(-1).id])) {
  const response = await fetch(`${base}/watch/${encodeURIComponent(id)}`);
  assert.equal(response.status, 200, `Existing watch ${id} must render successfully`);
  assert((await response.text()).includes("Specification standing"), "Watch details must render, not just a page shell");
}
const missingId = "__detail_route_regression_missing__";
assert(!watches.some(watch => watch.id === missingId));
const missing = await fetch(`${base}/watch/${missingId}`);
assert.equal(missing.status, 404, "Unknown watches must return 404");
console.log("Production detail routes passed: existing watches render and unknown watches return 404.");
