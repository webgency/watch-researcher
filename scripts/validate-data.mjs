#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const DATA_URL = new URL("../data/watches.json", import.meta.url);
const BRANDS_URL = new URL("../data/brands.json", import.meta.url);

const STATUSES = new Set(["wishlist", "owned", "sold"]);
const WISHLIST_TIERS = new Set(["next-purchase", "must-have", "love-it", "interested", "maybe-later", "pass"]);
const MOVEMENTS = new Set(["automatic", "manual", "quartz", "spring-drive", "solar", "kinetic", "other"]);
const CONDITIONS = new Set(["new", "pre-owned"]);
const CURRENCY_TO_USD = new Set(["USD", "EUR", "GBP", "CHF", "JPY"]);

const SPEC_TYPES = {
  caseDiameterMm: "number",
  caseThicknessMm: "number",
  lugToLugMm: "number",
  lugWidthMm: "number",
  caseMaterial: "string",
  movement: "movement",
  caliber: "string",
  powerReserveHours: "number",
  waterResistanceM: "number",
  crystal: "string",
  dialColor: "string",
  braceletStrap: "string",
  complications: "string",
};

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function checkString(value, path, errors, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) errors.push(`${path} is required`);
    return;
  }
  if (typeof value !== "string") errors.push(`${path} must be a string`);
}

function checkDate(value, path, errors, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) errors.push(`${path} is required`);
    return;
  }
  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
    errors.push(`${path} must be a valid date string`);
  }
}

function checkPositiveNumber(value, path, errors, { required = false, integer = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) errors.push(`${path} is required`);
    return;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    errors.push(`${path} must be a positive number`);
    return;
  }
  if (integer && !Number.isInteger(value)) errors.push(`${path} must be a whole number`);
}

function checkIntegerRange(value, path, errors, { required = false, min = 1, max = 5 } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) errors.push(`${path} is required`);
    return;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    errors.push(`${path} must be a whole number from ${min} to ${max}`);
  }
}

function checkMoney(value, path, errors) {
  if (value === undefined || value === null) return;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  checkPositiveNumber(value.amount, `${path}.amount`, errors, { required: true });
  if (typeof value.currency !== "string" || !/^[A-Z]{3}$/.test(value.currency)) {
    errors.push(`${path}.currency must be a 3-letter currency code`);
  } else if (!CURRENCY_TO_USD.has(value.currency)) {
    warnings.push(`${path}.currency ${value.currency} is not in the known currency list; scoring will use its fallback rate.`);
  }
}

function checkLinks(value, path, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }
  value.forEach((link, index) => {
    const linkPath = `${path}[${index}]`;
    if (!isRecord(link)) {
      errors.push(`${linkPath} must be an object`);
      return;
    }
    checkString(link.url, `${linkPath}.url`, errors, { required: true });
    checkString(link.retailer, `${linkPath}.retailer`, errors);
    checkMoney(link.price, `${linkPath}.price`, errors);
    if (link.condition !== undefined && !CONDITIONS.has(link.condition)) {
      errors.push(`${linkPath}.condition must be new or pre-owned`);
    }
  });
}

function checkSpecs(value, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const [key, type] of Object.entries(SPEC_TYPES)) {
    const specPath = `${path}.${key}`;
    const specValue = value[key];
    if (specValue === undefined || specValue === null || specValue === "") continue;
    if (type === "number") checkPositiveNumber(specValue, specPath, errors);
    else if (type === "movement" && !MOVEMENTS.has(specValue)) errors.push(`${specPath} must be a known movement type`);
    else if (type === "string") checkString(specValue, specPath, errors);
  }
}

function checkTags(value, path, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }
  value.forEach((tag, index) => checkString(tag, `${path}[${index}]`, errors, { required: true }));
}

function checkTransaction(value, path, errors) {
  if (value === undefined || value === null) return;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  checkMoney(value.price, `${path}.price`, errors);
  checkDate(value.date, `${path}.date`, errors);
}

const errors = [];
const warnings = [];
const ids = new Set();
const watches = JSON.parse(await readFile(DATA_URL, "utf8"));
const brands = JSON.parse(await readFile(BRANDS_URL, "utf8"));
const normalizedBrandNames = new Set();

if (!isRecord(brands)) {
  errors.push("data/brands.json must contain an object");
} else {
  for (const [brand, info] of Object.entries(brands)) {
    const path = `brands.${brand}`;
    if (!brand.trim()) errors.push(`${path} brand name is required`);
    normalizedBrandNames.add(brand.trim().toLowerCase());
    if (!isRecord(info)) {
      errors.push(`${path} must be an object`);
      continue;
    }
    checkIntegerRange(info.reputationTier, `${path}.reputationTier`, errors, { required: true });
  }
}

if (!Array.isArray(watches)) {
  errors.push("data/watches.json must contain an array");
} else {
  watches.forEach((watch, index) => {
    const path = `watches[${index}]`;
    if (!isRecord(watch)) {
      errors.push(`${path} must be an object`);
      return;
    }

    checkString(watch.id, `${path}.id`, errors, { required: true });
    if (watch.id) {
      if (ids.has(watch.id)) errors.push(`${path}.id duplicates ${watch.id}`);
      ids.add(watch.id);
    }
    checkString(watch.brand, `${path}.brand`, errors, { required: true });
    checkString(watch.model, `${path}.model`, errors, { required: true });
    checkString(watch.referenceNumber, `${path}.referenceNumber`, errors);
    if (!STATUSES.has(watch.status)) errors.push(`${path}.status must be wishlist, owned, or sold`);
    if (watch.wishlistTier !== undefined && !WISHLIST_TIERS.has(watch.wishlistTier)) {
      errors.push(`${path}.wishlistTier must be one of ${Array.from(WISHLIST_TIERS).join(", ")}`);
    }
    checkIntegerRange(watch.designUniqueness, `${path}.designUniqueness`, errors);
    checkMoney(watch.price, `${path}.price`, errors);
    checkDate(watch.priceUpdatedAt, `${path}.priceUpdatedAt`, errors);
    checkLinks(watch.links, `${path}.links`, errors);
    checkString(watch.imageUrl, `${path}.imageUrl`, errors);
    checkSpecs(watch.specs, `${path}.specs`, errors);
    checkTags(watch.tags, `${path}.tags`, errors);
    checkString(watch.notes, `${path}.notes`, errors);
    checkDate(watch.dateAdded, `${path}.dateAdded`, errors, { required: true });
    checkTransaction(watch.purchase, `${path}.purchase`, errors);
    checkTransaction(watch.sale, `${path}.sale`, errors);

    const normalizedBrand = typeof watch.brand === "string" ? watch.brand.trim().toLowerCase() : "";
    if (normalizedBrand && !normalizedBrandNames.has(normalizedBrand)) {
      warnings.push(`${path}.brand ${watch.brand} is not present in data/brands.json; desirability scoring will use neutral reputation.`);
    }
  });
}

if (warnings.length) {
  console.warn(`Watch data validation completed with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}:`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error(`Watch data validation failed with ${errors.length} issue${errors.length === 1 ? "" : "s"}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const statuses = watches.reduce((acc, watch) => {
  acc[watch.status] = (acc[watch.status] ?? 0) + 1;
  return acc;
}, {});
const priced = watches.filter((watch) => watch.price).length;

console.log(`Watch data OK: ${watches.length} watches, ${priced} priced, statuses ${JSON.stringify(statuses)}`);
