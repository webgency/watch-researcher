// The categories RUBRICS actually has a column for.
//
// Plain .mjs so scripts/audit-data.mjs can read it under bare Node. rubrics.ts
// is the authority and imports this rather than restating the list, so a
// category added there cannot be missed here.
export const RUBRIC_CATEGORIES = ["diver", "chronograph", "gmt", "dress", "sports"];
