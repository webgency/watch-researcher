#!/usr/bin/env node
// Enrich data/watches.json with price + image scraped from each watch's
// retailer links. Zero dependencies (uses Node 18+ global fetch).
//
// IMPORTANT: run this where there is real outbound network access — i.e. a
// LOCAL Claude Code / terminal session on your own machine. The cloud sandbox
// (Claude Code on the web, even when viewed through the desktop app) routes
// outbound traffic through an egress proxy that blocks retailer domains, so
// every fetch there returns 403 and nothing will be found.
//
// Usage:
//   node scripts/enrich-watches.mjs           # fetch + write (skips fields already set)
//   node scripts/enrich-watches.mjs --dry     # report only, write nothing
//   node scripts/enrich-watches.mjs --force   # overwrite existing price/imageUrl
//   node scripts/enrich-watches.mjs --id=foo  # only this watch id (repeatable)
//   node scripts/enrich-watches.mjs --verbose # show per-link failures

import { readFile, writeFile } from "node:fs/promises";

const DATA_URL = new URL("../data/watches.json", import.meta.url);

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const FORCE = args.includes("--force");
const VERBOSE = args.includes("--verbose");
const ONLY = args.filter((a) => a.startsWith("--id=")).map((a) => a.slice(5));

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const SYMBOL_TO_ISO = {
  "US$": "USD", "A$": "AUD", "AU$": "AUD", "C$": "CAD", "CA$": "CAD",
  $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₣": "CHF",
};

async function fetchText(url, { json = false } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept: json
          ? "application/json,*/*"
          : "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, body: await res.text(), finalUrl: res.url };
  } catch (e) {
    return { ok: false, error: e.name === "AbortError" ? "timeout" : e.message };
  } finally {
    clearTimeout(timer);
  }
}

// Parse a price string like "$5,400.00", "€1.490", "GBP 1,200" -> { amount, currency? }.
function parseMoney(raw, fallbackCurrency) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  let currency = fallbackCurrency;
  const code = s.match(/\b(USD|EUR|GBP|JPY|CHF|AUD|CAD|SEK|NOK|DKK|HKD|SGD|NZD)\b/i);
  if (code) currency = code[1].toUpperCase();
  else {
    for (const [sym, iso] of Object.entries(SYMBOL_TO_ISO)) {
      if (s.includes(sym)) { currency = iso; break; }
    }
  }

  let num = s.replace(/[^0-9.,]/g, "");
  if (!num) return null;
  if (num.includes(",") && num.includes(".")) {
    // Whichever separator comes last is the decimal point.
    num = num.lastIndexOf(",") > num.lastIndexOf(".")
      ? num.replace(/\./g, "").replace(",", ".")
      : num.replace(/,/g, "");
  } else if (num.includes(",")) {
    num = /,\d{2}$/.test(num) ? num.replace(",", ".") : num.replace(/,/g, "");
  }
  const amount = Number(num);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, currency };
}

function absolutize(u, base) {
  if (!u) return undefined;
  try { return new URL(u, base).href.replace(/^http:/, "https:"); } catch { return undefined; }
}

function extractFromJsonLd(html, baseUrl) {
  const out = {};
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const b of blocks) {
    let data;
    try { data = JSON.parse(b[1].trim()); } catch { continue; }
    const nodes = [];
    const push = (d) => d && typeof d === "object" && nodes.push(d);
    if (Array.isArray(data)) data.forEach(push);
    else { push(data); if (Array.isArray(data["@graph"])) data["@graph"].forEach(push); }

    for (const node of nodes) {
      const type = node["@type"];
      const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
      if (!isProduct) continue;
      if (!out.image) {
        let img = node.image;
        if (Array.isArray(img)) img = img[0];
        if (img && typeof img === "object") img = img.url || img.contentUrl;
        if (typeof img === "string") out.image = absolutize(img, baseUrl);
      }
      if (!out.price) {
        let offers = node.offers;
        if (Array.isArray(offers)) offers = offers[0];
        if (offers && typeof offers === "object") {
          const m = parseMoney(offers.price ?? offers.lowPrice ?? offers.highPrice, offers.priceCurrency);
          if (m) out.price = m;
        }
      }
    }
  }
  return out;
}

function metaContent(html, names) {
  for (const n of names) {
    const a = html.match(new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${n}["'][^>]*content=["']([^"']+)["']`, "i"));
    if (a) return a[1];
    const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${n}["']`, "i"));
    if (b) return b[1];
  }
  return undefined;
}

function extractFromMeta(html, baseUrl) {
  const out = {};
  const img = metaContent(html, ["og:image:secure_url", "og:image", "twitter:image"]);
  if (img) out.image = absolutize(img, baseUrl);
  const m = parseMoney(
    metaContent(html, ["product:price:amount", "og:price:amount", "price"]),
    metaContent(html, ["product:price:currency", "og:price:currency", "priceCurrency"])
  );
  if (m) out.price = m;
  return out;
}

// Shopify exposes a clean product JSON at <origin>/products/<handle>.json.
async function tryShopify(url) {
  const m = url.match(/^(https?:\/\/[^/]+)\/products\/([^/?#]+)/i);
  if (!m) return null;
  const r = await fetchText(`${m[1]}/products/${m[2]}.json`, { json: true });
  if (!r.ok) return null;
  let data;
  try { data = JSON.parse(r.body); } catch { return null; }
  const p = data.product;
  if (!p) return null;
  const out = { source: "shopify" };
  const variant = (p.variants || []).find((v) => v.available) || (p.variants || [])[0];
  if (variant?.price != null) out.price = parseMoney(String(variant.price)); // currency unknown here
  const image = (p.images || [])[0];
  if (image?.src) out.image = absolutize(image.src, m[1]);
  return out;
}

async function enrichLink(url) {
  const result = (await tryShopify(url).catch(() => null)) || {};

  const page = await fetchText(url);
  if (page.ok) {
    const base = page.finalUrl || url;
    const ld = extractFromJsonLd(page.body, base);
    const meta = extractFromMeta(page.body, base);
    result.image = result.image || ld.image || meta.image;
    result.price = result.price || ld.price || meta.price;
    // Backfill currency for a Shopify amount that came without one.
    if (result.price && !result.price.currency) {
      result.price.currency = ld.price?.currency || meta.price?.currency;
    }
    result.source = result.source || (ld.price || ld.image ? "json-ld" : meta.price || meta.image ? "og-meta" : undefined);
  } else if (!result.price && !result.image) {
    return { error: page.status ? `HTTP ${page.status}` : page.error };
  }

  if (result.price && !result.price.currency) result.price.currency = "USD"; // last resort
  return result;
}

const short = (s, n = 40) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function main() {
  const watches = JSON.parse(await readFile(DATA_URL, "utf8"));
  const targets = ONLY.length ? watches.filter((w) => ONLY.includes(w.id)) : watches;

  let priceN = 0, imageN = 0, changed = 0;
  const misses = [];

  for (const w of targets) {
    const name = `${w.brand} ${w.model}`;
    const needPrice = FORCE || !w.price;
    const needImage = FORCE || !w.imageUrl;
    if (!needPrice && !needImage) { if (VERBOSE) console.log(`· skip  ${name}`); continue; }

    let got = null;
    for (const link of w.links || []) {
      const r = await enrichLink(link.url);
      if (r && (r.price || r.image)) { got = r; break; }
      if (VERBOSE && r?.error) console.log(`    ${short(link.url, 48)} -> ${r.error}`);
      await new Promise((res) => setTimeout(res, 250)); // be polite between hosts
    }

    if (!got) { misses.push(name); console.log(`✗ miss  ${name}`); continue; }
    const did = [];
    if (needPrice && got.price) { w.price = got.price; w.priceUpdatedAt = new Date().toISOString(); priceN++; did.push(`${got.price.amount} ${got.price.currency}`); }
    if (needImage && got.image) { w.imageUrl = got.image; imageN++; did.push("image"); }
    if (did.length) { changed++; console.log(`✓ ${String(got.source || "?").padEnd(8)}${name.padEnd(34)} ${did.join(", ")}`); }
    else { misses.push(name); console.log(`✗ miss  ${name} (nothing usable)`); }
  }

  console.log(`\nPrices: ${priceN}  ·  Images: ${imageN}  ·  Watches changed: ${changed}/${targets.length}`);
  if (misses.length) console.log(`Missing (${misses.length}): ${misses.map((m) => short(m, 22)).join("; ")}`);

  if (DRY) return console.log("\n--dry: nothing written.");
  if (changed) {
    await writeFile(DATA_URL, JSON.stringify(watches, null, 2) + "\n");
    console.log("\nWrote data/watches.json — review with: git diff data/watches.json");
  } else {
    console.log("\nNo changes; file untouched.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
