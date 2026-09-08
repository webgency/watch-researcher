// Best-effort scraper that turns a retailer/product URL into a partial watch.
// Used by the /api/scrape route to pre-fill the add form. Pulls price/image/
// brand/model from structured data (Shopify JSON, JSON-LD, OpenGraph) and the
// remaining details from the page text — via the Claude API when
// ANTHROPIC_API_KEY is configured (see extract.ts), else the legacy regex
// extractor. Whatever it can't find, the user fills in.
//
// Runs server-side only (needs open outbound network). Never throws on a bad
// page — it just returns whatever it managed to extract.

import { extractWatchDetails } from "./extract";
import { Friction, Money, MovementType, QualityFlags, WatchInput, WatchSpecs } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const SYMBOL_TO_ISO: Record<string, string> = {
  "US$": "USD", "A$": "AUD", "AU$": "AUD", "C$": "CAD", "CA$": "CAD",
  $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₣": "CHF",
};

export type ScrapeResult = Partial<
  Pick<WatchInput, "brand" | "model" | "referenceNumber" | "price" | "imageUrl" | "specs" | "tags">
> & {
  retailer?: string;
  foundNothing?: boolean;
  qualityFlags?: QualityFlags;
  /** brandLiquidity is a user judgment call, so scraped friction is partial. */
  friction?: Partial<Friction>;
};

async function fetchText(url: string, json = false) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept: json ? "application/json,*/*" : "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return { ok: false as const };
    return { ok: true as const, body: await res.text(), finalUrl: res.url };
  } catch {
    return { ok: false as const };
  } finally {
    clearTimeout(timer);
  }
}

function clean(s: string): string {
  return s
    .replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function parseMoney(raw: unknown, fallback?: string): Money | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  let currency = fallback;
  const code = s.match(/\b(USD|EUR|GBP|JPY|CHF|AUD|CAD|SEK|NOK|DKK|HKD|SGD|NZD)\b/i);
  if (code) currency = code[1].toUpperCase();
  else for (const [sym, iso] of Object.entries(SYMBOL_TO_ISO)) { if (s.includes(sym)) { currency = iso; break; } }
  let num = s.replace(/[^0-9.,]/g, "");
  if (!num) return undefined;
  if (num.includes(",") && num.includes("."))
    num = num.lastIndexOf(",") > num.lastIndexOf(".") ? num.replace(/\./g, "").replace(",", ".") : num.replace(/,/g, "");
  else if (num.includes(",")) num = /,\d{2}$/.test(num) ? num.replace(",", ".") : num.replace(/,/g, "");
  const amount = Number(num);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return { amount, currency: currency || "USD" };
}

function absolutize(u: string | undefined, base: string): string | undefined {
  if (!u) return undefined;
  try { return new URL(u, base).href.replace(/^http:/, "https:"); } catch { return undefined; }
}

function hostnameOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function stripText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Extracted = { brand?: string; name?: string; ref?: string; price?: Money; image?: string };

// Some direct-to-consumer Shopify stores use the vendor field for a collection
// name rather than the manufacturer. Keep verified exceptions narrow: on a
// marketplace, replacing a real product brand with the retailer would be worse.
const DOMAIN_BRANDS: Record<string, string> = {
  "spinnaker-watches.com": "Spinnaker",
};

function fromJsonLd(html: string, base: string): Extracted {
  const out: Extracted = {};
  for (const b of Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))) {
    let data: unknown;
    try { data = JSON.parse(b[1].trim()); } catch { continue; }
    const nodes: Record<string, unknown>[] = [];
    const push = (d: unknown) => { if (d && typeof d === "object") nodes.push(d as Record<string, unknown>); };
    if (Array.isArray(data)) data.forEach(push);
    else { push(data); const g = (data as Record<string, unknown>)?.["@graph"]; if (Array.isArray(g)) g.forEach(push); }

    for (const n of nodes) {
      const type = n["@type"];
      const isProduct = type === "Product" || (Array.isArray(type) && (type as unknown[]).includes("Product"));
      if (!isProduct) continue;
      if (!out.name && typeof n.name === "string") out.name = clean(n.name);
      if (!out.brand) {
        const brand = n.brand as { name?: string } | string | undefined;
        const bn = typeof brand === "string" ? brand : brand?.name;
        if (bn) out.brand = clean(bn);
      }
      if (!out.ref) {
        const ref = (n.mpn ?? n.sku) as string | number | undefined;
        if (ref != null) out.ref = clean(String(ref));
      }
      if (!out.image) {
        let img = n.image as unknown;
        if (Array.isArray(img)) img = img[0];
        if (img && typeof img === "object") img = (img as { url?: string; contentUrl?: string }).url ?? (img as { contentUrl?: string }).contentUrl;
        if (typeof img === "string") out.image = absolutize(img, base);
      }
      if (!out.price) {
        let offers = n.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
        if (Array.isArray(offers)) offers = offers[0];
        if (offers) {
          const m = parseMoney(offers.price ?? offers.lowPrice ?? offers.highPrice, offers.priceCurrency as string | undefined);
          if (m) out.price = m;
        }
      }
    }
  }
  return out;
}

function metaContent(html: string, names: string[]): string | undefined {
  for (const n of names) {
    const a = html.match(new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${n}["'][^>]*content=["']([^"']+)["']`, "i"));
    if (a) return a[1];
    const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${n}["']`, "i"));
    if (b) return b[1];
  }
  return undefined;
}

function fromMeta(html: string, base: string): Extracted {
  const out: Extracted = {};
  const img = metaContent(html, ["og:image:secure_url", "og:image", "twitter:image"]);
  if (img) out.image = absolutize(img, base);
  const title = metaContent(html, ["og:title", "twitter:title"]);
  if (title) out.name = clean(title.split(/\s[|–—-]\s/)[0]);
  const m = parseMoney(
    metaContent(html, ["product:price:amount", "og:price:amount", "price"]),
    metaContent(html, ["product:price:currency", "og:price:currency", "priceCurrency"])
  );
  if (m) out.price = m;
  return out;
}

// Shopify exposes a clean product JSON at <origin>/products/<handle>.json.
type ShopifyVariant = {
  id?: string | number;
  price?: string;
  price_currency?: string;
  available?: boolean;
  sku?: string;
  featured_image?: { src?: string } | null;
};

export function selectShopifyVariant(url: string, variants: ShopifyVariant[]): ShopifyVariant | undefined {
  let requestedId: string | null = null;
  try { requestedId = new URL(url).searchParams.get("variant"); } catch { /* use availability fallback */ }
  return variants.find((variant) => requestedId && String(variant.id) === requestedId)
    ?? variants.find((variant) => variant.available)
    ?? variants[0];
}

export function shopifyProductJsonUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const productsIndex = parts.indexOf("products");
    const handle = productsIndex >= 0 ? parts[productsIndex + 1] : undefined;
    if (!handle) return undefined;
    const prefix = parts.slice(0, productsIndex).join("/");
    return `${parsed.origin}/${prefix ? `${prefix}/` : ""}products/${handle}.json`;
  } catch {
    return undefined;
  }
}

export function isShopifyCollectionUrl(url: string): boolean {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts.includes("collections") && !parts.includes("products");
  } catch {
    return false;
  }
}

async function fromShopify(url: string) {
  const jsonUrl = shopifyProductJsonUrl(url);
  if (!jsonUrl) return null;
  const r = await fetchText(jsonUrl, true);
  if (!r.ok || !r.body) return null;
  let data: { product?: Record<string, unknown> };
  try { data = JSON.parse(r.body); } catch { return null; }
  const p = data.product;
  if (!p) return null;
  const variants = (p.variants as ShopifyVariant[]) || [];
  const v = selectShopifyVariant(url, variants);
  const out: { vendor?: string; title?: string; ref?: string; price?: Money; image?: string; bodyHtml?: string } = {};
  if (typeof p.vendor === "string") out.vendor = clean(p.vendor);
  if (typeof p.title === "string") out.title = clean(p.title);
  if (v?.sku) out.ref = clean(v.sku);
  if (v?.price != null) out.price = parseMoney(String(v.price), v.price_currency);
  const images = (p.images as { src?: string }[]) || [];
  const image = v?.featured_image?.src ?? images[0]?.src;
  if (image) out.image = absolutize(image, new URL(url).origin);
  if (typeof p.body_html === "string") out.bodyHtml = p.body_html;
  return out;
}

function firstHeading(html: string): string | undefined {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? clean(stripText(match[1])) : undefined;
}

/**
 * Prefer the product's main/specification content over the entire storefront.
 * Header navigation, size guides, cross-sells and footer copy routinely contain
 * other diameters, movements and complications that look like product specs.
 */
export function primaryProductText(html: string): string {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
  const text = stripText(main);
  const specStart = text.search(/\bSpecifications?\b/i);
  if (specStart === -1) return text;
  // Keep later product feature panels: brands often state the caliber and
  // power reserve below shipping accordions rather than in the spec table.
  const productTail = text.slice(specStart);
  const end = productTail.search(/\b(?:You may also like|Recently viewed|Customer reviews|FAQs?)\b/i);
  return end > 0 ? productTail.slice(0, end) : productTail;
}

/**
 * Shopify's product description is already scoped to the requested product.
 * Appending the full rendered page reintroduces variant selectors, recommendations,
 * and hidden quick-view cards whose specs can be mistaken for the primary watch.
 */
export function productExtractionText(shopifyBodyHtml: string | undefined, html: string): string {
  if (shopifyBodyHtml) return stripText(shopifyBodyHtml);
  return primaryProductText(html);
}

function num(text: string, re: RegExp): number | undefined {
  const m = text.match(re);
  return m ? Number(m[1]) : undefined;
}

export function extractSpecs(text: string): WatchSpecs {
  const t = text.replace(/\s+/g, " ");
  const low = t.toLowerCase();
  const s: WatchSpecs = {};

  s.caseDiameterMm =
    num(t, /(?:case\s*)?(?:diameter|case size|case width)\s*\(\s*mm\s*\)\s*[:\-]?\s*(\d{2}(?:\.\d{1,2})?)/i) ??
    num(t, /(?:case\s*)?(?:diameter|case size|case width)[^0-9]{0,12}(\d{2}(?:\.\d{1,2})?)\s?mm/i) ??
    num(t, /Ø\s?(\d{2}(?:\.\d{1,2})?)\s?mm/i) ??
    num(t, /\b(\d{2}(?:\.\d{1,2})?)\s?mm\b(?=[^.]{0,18}(?:case|diameter))/i);
  s.caseThicknessMm =
    num(t, /(?:thickness|case height|thick(?:ness)?)\s*\(\s*mm\s*\)\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)/i) ??
    num(t, /(?:thickness|case height|thick)[^0-9]{0,12}(\d{1,2}(?:\.\d{1,2})?)\s?mm/i) ??
    num(t, /\b(\d{1,2}(?:\.\d{1,2})?)\s?mm\b(?=[^.]{0,14}(?:thick))/i);
  s.lugToLugMm =
    num(t, /lug[\s-]*to[\s-]*lug[^0-9]{0,16}(\d{2}(?:\.\d{1,2})?)(?:\s?mm)?/i) ?? // "lug to lug (mm): 47"
    num(t, /(\d{2}(?:\.\d{1,2})?)\s?mm[\s)]{0,3}lug[\s-]*to[\s-]*lug/i); // "(47mm lug to lug)"
  s.lugWidthMm =
    num(t, /lug[\s-]*width[^0-9]{0,14}(\d{2})\s?mm/i) ??
    num(t, /strap[\s-]*width[^0-9]{0,12}(\d{2})\s?mm/i) ??
    num(t, /\bband\b[^0-9]{0,8}(\d{2})\s?mm/i);
  s.powerReserveHours =
    num(t, /power\s*reserve[^0-9]{0,28}(\d{2,3})\s?h\b/i) ??
    num(t, /(\d{2,3})\s?h(?:ours)?\s*(?:of\s*)?power\s*reserve/i);

  const wm = t.match(/water[\s-]*resist[a-z]*[^0-9]{0,16}(\d{2,4})\s?m\b/i) || t.match(/(\d{2,4})\s?m(?:eters)?\s*(?:of\s*)?water/i);
  const atm = t.match(/(\d{1,3})\s?(?:atm|bar)\b/i);
  if (wm) s.waterResistanceM = Number(wm[1]);
  else if (atm) s.waterResistanceM = Number(atm[1]) * 10;

  const moves: [RegExp, MovementType][] = [
    [/spring[\s-]?drive/, "spring-drive"],
    [/meca[\s-]?quartz|mecaquartz/, "quartz"],
    [/quartz/, "quartz"],
    [/hand[\s-]?wound|hand[\s-]?wind(?:ing)?|manual[\s-]?wind(?:ing)?|manual winding/, "manual"],
    [/self[\s-]?winding|automatic/, "automatic"],
    [/solar/, "solar"],
    [/kinetic/, "kinetic"],
  ];
  // A labeled spec wins over later page copy such as "instruction manual" or
  // generic collection descriptions mentioning other movement types.
  const labeledMovement = t.match(/\bmovement\s*:\s*([^.;]{2,100})/i)?.[1]?.toLowerCase();
  const movementSource = labeledMovement || low;
  for (const [re, val] of moves) if (re.test(movementSource)) { s.movement = val; break; }

  const cal = t.match(/cali(?:ber|bre)\s*[:\-]?\s*([A-Za-z0-9][\w .\-\/]{1,30})/i);
  const namedMovement = t.match(/\b((?:Miyota|Seiko|Sellita|ETA|Ronda|Soprod|La Joux-Perret|Seagull)\s+[A-Z0-9][A-Z0-9.\-]{1,15})\s+(?:automatic|manual|quartz)?\s*movement\b/i);
  if (cal || namedMovement) {
    const match = cal ?? namedMovement!;
    let c = match[1].split(/\s+(?:automatic|manual|self|swiss|cosc|movement|winding|finishe?s?|with|hand|\d+\s?jewel)/i)[0].trim();
    c = c.replace(/[.,;:]+$/, "").trim();
    if (c.length >= 2 && /\d/.test(c)) s.caliber = c; // require a digit to avoid grabbing prose
  }

  if (/sapphire/.test(low)) s.crystal = "Sapphire";
  else if (/acrylic|hesalite|plexi/.test(low)) s.crystal = "Acrylic";
  else if (/mineral/.test(low)) s.crystal = "Mineral";
  else if (/hardlex/.test(low)) s.crystal = "Hardlex";

  const caseMaterial = t.match(/case material\s*[:\-]?\s*([^.;]{3,60})/i);
  if (caseMaterial) s.caseMaterial = clean(caseMaterial[1]).split(/\s+(?:case size|diameter|thickness)\b/i)[0].trim();
  const dialColor = t.match(/dial colou?r\s*[:\-]?\s*([A-Za-z][A-Za-z /\-]{1,30})/i);
  if (dialColor) s.dialColor = clean(dialColor[1]).split(/\s+(?:index|lens|crystal|case)\b/i)[0].trim();
  const band = t.match(/\b(?:band|bracelet|strap)\s*:\s*([^.;]{3,100})/i);
  if (band) s.braceletStrap = clean(band[1]).split(/\s+(?:extra band|water resistance|weight|warranty)\b/i)[0].trim();

  const comps: string[] = [];
  const compMap: [RegExp, string][] = [
    [/chronograph/, "Chronograph"], [/\bgmt\b/, "GMT"], [/world[\s-]?timer/, "Worldtimer"],
    [/moon[\s-]?phase/, "Moon phase"], [/perpetual calendar/, "Perpetual calendar"],
    [/annual calendar/, "Annual calendar"], [/tourbillon/, "Tourbillon"], [/tachymeter/, "Tachymeter"],
  ];
  for (const [re, label] of compMap) if (re.test(low)) comps.push(label);
  if (comps.length) s.complications = comps.join(", ");

  for (const k of Object.keys(s) as (keyof WatchSpecs)[]) if (s[k] === undefined) delete s[k];
  return s;
}

function fallbackTags(text: string, specs: WatchSpecs): string[] {
  const tags: string[] = [];
  if (/\b(?:diver|diving watch|dive watch)\b/i.test(text) && (specs.waterResistanceM ?? 0) >= 100) tags.push("diver");
  if (/\bchronograph\b/i.test(text)) tags.push("chronograph");
  if (/\bGMT\b/.test(text)) tags.push("GMT");
  if (/\bworld[ -]?timer\b/i.test(text)) tags.push("worldtimer");
  return tags;
}

export async function scrapeWatch(url: string): Promise<ScrapeResult> {
  const shop = await fromShopify(url).catch(() => null);
  const page = await fetchText(url);
  const html = page.ok && page.body ? page.body : "";
  const base = (page.ok && page.finalUrl) || url;

  const ld = html ? fromJsonLd(html, base) : {};
  const og = html ? fromMeta(html, base) : {};

  const out: ScrapeResult = { retailer: hostnameOf(base) };

  const domainBrand = DOMAIN_BRANDS[hostnameOf(base)];
  const heading = html ? firstHeading(html) : undefined;
  const brand = domainBrand || shop?.vendor || ld.brand;
  let model =
    domainBrand && heading
      ? [heading, shop?.title && shop.title !== heading ? shop.title : undefined].filter(Boolean).join(" — ")
      : ld.name || shop?.title || og.name;
  if (model && brand && model.toLowerCase().startsWith(brand.toLowerCase())) {
    model = model.slice(brand.length).replace(/^[\s\-–—:|]+/, "").trim();
  }
  if (brand) out.brand = brand.replace(/_/g, " ");
  if (model) out.model = model;
  if (shop?.ref || ld.ref) out.referenceNumber = shop?.ref || ld.ref;

  const price = ld.price || og.price || shop?.price;
  if (price) {
    // Backfill a Shopify amount (no currency) from a currency we did find.
    if (!price.currency || price.currency === "USD") price.currency = ld.price?.currency || og.price?.currency || price.currency || "USD";
    out.price = price;
  }

  const image = ld.image || og.image || shop?.image;
  if (image) out.imageUrl = image;

  // A collection landing page contains many product cards and often similarly
  // named families (for example a three-hand Hudson beside a Hudson GMT).
  // Returning fewer fields is safer than attaching one sibling's specs to another.
  const specText = isShopifyCollectionUrl(url) ? "" : productExtractionText(shop?.bodyHtml, html).trim();
  const extracted = await extractWatchDetails(specText);
  if (extracted) {
    // Structured data (JSON-LD/Shopify/OG) wins for identity fields; the model
    // fills whatever those missed.
    if (!out.brand && extracted.brand) out.brand = extracted.brand;
    if (!out.model && extracted.model) out.model = extracted.model;
    if (!out.referenceNumber && extracted.referenceNumber) out.referenceNumber = extracted.referenceNumber;
    if (Object.keys(extracted.specs).length) out.specs = extracted.specs;
    if (extracted.tags.length) out.tags = extracted.tags;
    if (extracted.qualityFlags) out.qualityFlags = extracted.qualityFlags;
    if (extracted.friction) out.friction = extracted.friction;
  } else {
    const specs = extractSpecs(specText);
    if (Object.keys(specs).length) out.specs = specs;
    const tags = fallbackTags(specText, specs);
    if (tags.length) out.tags = tags;
  }

  out.foundNothing =
    !out.brand && !out.model && !out.price && !out.imageUrl && !out.specs && !out.tags;
  return out;
}
