// Prepares a static, read-only subset of the app for the GitHub Pages export.
//
// GitHub Pages can't run a server, so the routes that need one — the JSON API
// and the add/edit forms that POST to it — are removed before `next build`
// with output: 'export'. This runs only in CI on a throwaway checkout; your
// committed source keeps the full editable app for local use.
import { rm } from "node:fs/promises";

const serverOnlyRoutes = [
  "src/app/api",
  "src/app/watch/new",
  "src/app/watch/[id]/edit",
];

for (const path of serverOnlyRoutes) {
  await rm(path, { recursive: true, force: true });
  console.log(`prepare-pages: removed ${path}`);
}
