// Best-effort scraper that turns a retailer/product URL into a partial watch.
// Used by the /api/scrape route to pre-fill the add form. Pulls price/image/
// brand/model from structured data (Shopify JSON, JSON-LD, OpenGraph) and the
// remaining specs from the page text. Whatever it can't find, the user fills in.
//
// Runs server-side only (needs open outbound network). Never throws on a bad
// page — it just returns whatever it managed to extract.

import { Money, MovementType, WatchInput, WatchSpecs } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const SYMBOL_TO_ISO: Record<string, string> = {
  "US$": "USD", "A$": "AUD", "AU$": "AUD", "C$": "CAD", "CA$": "CAD",
  $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₣": "CHF",
};

export type ScrapeResult = Partial<
  Pick<WatchInput, "brand" | "model" | "referenceNumber" | "price" | "imageUrl" | "specs">
> & { retailer?: string; foundNothing?: boolean };

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
async function fromShopify(url: string) {
  const m = url.match(/^(https?:\/\/[^/]+)\/products\/([^/?#]+)/i);
  if (!m) return null;
  const r = await fetchText(`${m[1]}/products/${m[2]}.json`, true);
  if (!r.ok || !r.body) return null;
  let data: { product?: Record<string, unknown> };
  try { data = JSON.parse(r.body); } catch { return null; }
  const p = data.product;
  if (!p) return null;
  const variants = (p.variants as { price?: string; available?: boolean }[]) || [];
  const v = variants.find((x) => x.available) || variants[0];
  const out: { vendor?: string; title?: string; price?: Money; image?: string; bodyHtml?: string } = {};
  if (typeof p.vendor === "string") out.vendor = clean(p.vendor);
  if (typeof p.title === "string") out.title = clean(p.title);
  if (v?.price != null) out.price = parseMoney(String(v.price)); // currency unknown here
  const images = (p.images as { src?: string }[]) || [];
  if (images[0]?.src) out.image = absolutize(images[0].src, m[1]);
  if (typeof p.body_html === "string") out.bodyHtml = p.body_html;
  return out;
}

function num(text: string, re: RegExp): number | undefined {
  const m = text.match(re);
  return m ? Number(m[1]) : undefined;
}

function extractSpecs(text: string): WatchSpecs {
  const t = text.replace(/\s+/g, " ");
  const low = t.toLowerCase();
  const s: WatchSpecs = {};

  s.caseDiameterMm =
    num(t, /(?:case\s*)?(?:diameter|case size|case width)[^0-9]{0,12}(\d{2}(?:\.\d{1,2})?)\s?mm/i) ??
    num(t, /Ø\s?(\d{2}(?:\.\d{1,2})?)\s?mm/i) ??
    num(t, /\b(\d{2}(?:\.\d{1,2})?)\s?mm\b(?=[^.]{0,18}(?:case|diameter))/i);
  s.caseThicknessMm =
    num(t, /(?:thickness|case height|thick)[^0-9]{0,12}(\d{1,2}(?:\.\d{1,2})?)\s?mm/i) ??
    num(t, /\b(\d{1,2}(?:\.\d{1,2})?)\s?mm\b(?=[^.]{0,14}(?:thick))/i);
  s.lugToLugMm =
    num(t, /lug[\s-]*to[\s-]*lug[^0-9)]{0,8}(\d{2}(?:\.\d{1,2})?)\s?mm/i) ?? // "lug to lug 47mm"
    num(t, /(\d{2}(?:\.\d{1,2})?)\s?mm[\s)]{0,3}lug[\s-]*to[\s-]*lug/i); // "(47mm lug to lug)"
  s.lugWidthMm =
    num(t, /lug[\s-]*width[^0-9]{0,14}(\d{2})\s?mm/i) ??
    num(t, /strap[\s-]*width[^0-9]{0,12}(\d{2})\s?mm/i);
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
  for (const [re, val] of moves) if (re.test(low)) { s.movement = val; break; }

  const cal = t.match(/cali(?:ber|bre)\s*[:\-]?\s*([A-Za-z0-9][\w .\-\/]{1,30})/i);
  if (cal) {
    let c = cal[1].split(/\s+(?:automatic|manual|self|swiss|cosc|movement|winding|finishe?s?|with|hand|\d+\s?jewel)/i)[0].trim();
    c = c.replace(/[.,;:]+$/, "").trim();
    if (c.length >= 2 && /\d/.test(c)) s.caliber = c; // require a digit to avoid grabbing prose
  }

  if (/sapphire/.test(low)) s.crystal = "Sapphire";
  else if (/acrylic|hesalite|plexi/.test(low)) s.crystal = "Acrylic";
  else if (/mineral/.test(low)) s.crystal = "Mineral";
  else if (/hardlex/.test(low)) s.crystal = "Hardlex";

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

export async function scrapeWatch(url: string): Promise<ScrapeResult> {
  const shop = await fromShopify(url).catch(() => null);
  const page = await fetchText(url);
  const html = page.ok && page.body ? page.body : "";
  const base = (page.ok && page.finalUrl) || url;

  const ld = html ? fromJsonLd(html, base) : {};
  const og = html ? fromMeta(html, base) : {};

  const out: ScrapeResult = { retailer: hostnameOf(base) };

  const brand = shop?.vendor || ld.brand;
  let model = ld.name || shop?.title || og.name;
  if (model && brand && model.toLowerCase().startsWith(brand.toLowerCase())) {
    model = model.slice(brand.length).replace(/^[\s\-–—:|]+/, "").trim();
  }
  if (brand) out.brand = brand.replace(/_/g, " ");
  if (model) out.model = model;
  if (ld.ref) out.referenceNumber = ld.ref;

  const price = ld.price || og.price || shop?.price;
  if (price) {
    // Backfill a Shopify amount (no currency) from a currency we did find.
    if (!price.currency || price.currency === "USD") price.currency = ld.price?.currency || og.price?.currency || price.currency || "USD";
    out.price = price;
  }

  const image = ld.image || og.image || shop?.image;
  if (image) out.imageUrl = image;

  const specText = `${shop?.bodyHtml ? stripText(shop.bodyHtml) : ""} ${html ? stripText(html) : ""}`.trim();
  const specs = extractSpecs(specText);
  if (Object.keys(specs).length) out.specs = specs;

  out.foundNothing = !out.brand && !out.model && !out.price && !out.imageUrl && !out.specs;
  return out;
}
