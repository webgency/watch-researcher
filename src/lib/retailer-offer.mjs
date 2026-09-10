const SYMBOL_TO_ISO = {
  "US$": "USD", "A$": "AUD", "AU$": "AUD", "C$": "CAD", "CA$": "CAD",
  $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₣": "CHF",
};

const CURRENCY_CODES = "USD|EUR|GBP|JPY|CHF|AUD|CAD|SEK|NOK|DKK|HKD|SGD|NZD";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse a stated amount only when its ISO currency is also known. */
export function parseRetailMoney(raw, fallbackCurrency) {
  if (raw == null) return undefined;
  const value = String(raw).trim();
  if (!value) return undefined;

  let currency = fallbackCurrency?.trim().toUpperCase();
  const code = value.match(new RegExp(`\\b(${CURRENCY_CODES})\\b`, "i"));
  if (code) currency = code[1].toUpperCase();
  else {
    for (const [symbol, iso] of Object.entries(SYMBOL_TO_ISO)) {
      if (value.includes(symbol)) {
        currency = iso;
        break;
      }
    }
  }
  if (!currency || !new RegExp(`^(${CURRENCY_CODES})$`).test(currency)) return undefined;

  let numeric = value.replace(/[^0-9.,]/g, "");
  if (!numeric) return undefined;
  if (numeric.includes(",") && numeric.includes(".")) {
    numeric = numeric.lastIndexOf(",") > numeric.lastIndexOf(".")
      ? numeric.replace(/\./g, "").replace(",", ".")
      : numeric.replace(/,/g, "");
  } else if (numeric.includes(",")) {
    numeric = /,\d{2}$/.test(numeric) ? numeric.replace(",", ".") : numeric.replace(/,/g, "");
  }
  const amount = Number(numeric);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return { amount, currency };
}

export function conditionFromValue(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "new" || /(?:^|[/#])newcondition$/.test(normalized)) return "new";
  if (
    normalized === "pre-owned" || normalized === "used" || normalized === "refurbished" ||
    /(?:^|[/#])(?:used|refurbished|damaged)condition$/.test(normalized)
  ) return "pre-owned";
  return undefined;
}

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

function searchable(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const GENERIC_BRAND_WORDS = new Set([
  "and", "company", "official", "supply", "the", "watch", "watches",
]);

/**
 * A manufacturer-hosted product page is new retail unless the page explicitly
 * says otherwise. Matching is deliberately hostname-only: seeing a brand in a
 * marketplace path or page title is not enough to call the listing new.
 */
export function isBrandRetailUrl(url, brand) {
  const host = searchable(hostnameOf(url));
  const tokens = String(brand ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !GENERIC_BRAND_WORDS.has(token));
  return Boolean(host && tokens.length && tokens.every((token) => host.includes(token)));
}

export function inferRetailCondition({ url, brand, explicitCondition }) {
  const explicit = conditionFromValue(explicitCondition);
  if (explicit) return explicit;

  let path = "";
  try { path = new URL(url).pathname.toLowerCase(); } catch { /* unknown stays unknown */ }
  if (/pre[-_]?owned|certified[-_]?pre[-_]?owned|second[-_]?hand|\/used(?:\/|$)/.test(path)) {
    return "pre-owned";
  }
  return isBrandRetailUrl(url, brand) ? "new" : undefined;
}

function collectProductNodes(value, products, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectProductNodes(item, products, seen);
    return;
  }
  const type = value["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) products.push(value);
  for (const nested of Object.values(value)) collectProductNodes(nested, products, seen);
}

function urlPath(value) {
  if (typeof value !== "string") return undefined;
  try { return new URL(value).pathname.replace(/\/$/, ""); } catch { return undefined; }
}

function moneyFromOffer(offer) {
  if (!offer || typeof offer !== "object") return undefined;
  const specification = offer.priceSpecification && typeof offer.priceSpecification === "object"
    ? offer.priceSpecification
    : undefined;
  return parseRetailMoney(
    offer.price ?? offer.lowPrice ?? specification?.price,
    offer.priceCurrency ?? specification?.priceCurrency,
  );
}

function jsonLdOffer(html, pageUrl) {
  const products = [];
  for (const match of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try { collectProductNodes(JSON.parse(match[1].trim()), products); } catch { /* malformed block */ }
  }
  const pagePath = urlPath(pageUrl);
  products.sort((left, right) => {
    const leftMatch = urlPath(left.url) === pagePath ? 1 : 0;
    const rightMatch = urlPath(right.url) === pagePath ? 1 : 0;
    return rightMatch - leftMatch;
  });

  for (const product of products) {
    const offers = Array.isArray(product.offers) ? product.offers : [product.offers];
    for (const offer of offers) {
      const price = moneyFromOffer(offer);
      if (price) {
        return {
          price,
          condition: conditionFromValue(offer?.itemCondition ?? product.itemCondition),
          source: "json-ld",
        };
      }
    }
  }
  return undefined;
}

function metaContent(html, names) {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const first = html.match(new RegExp(
      `<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]*content=["']([^"']+)["']`,
      "i",
    ));
    if (first) return first[1];
    const reversed = html.match(new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${escaped}["']`,
      "i",
    ));
    if (reversed) return reversed[1];
  }
  return undefined;
}

function metaOffer(html) {
  const price = parseRetailMoney(
    metaContent(html, ["product:price:amount", "og:price:amount", "price"]),
    metaContent(html, ["product:price:currency", "og:price:currency", "priceCurrency"]),
  );
  if (!price) return undefined;
  return {
    price,
    condition: conditionFromValue(metaContent(html, ["product:condition", "og:condition", "itemCondition"])),
    source: "price-meta",
  };
}

function decodedCommerceText(html) {
  // Next.js flight data and Shopify analytics frequently embed JSON inside a
  // JavaScript string. Decode only quote/slash escapes; regexes below still
  // require an exact URL handle or the current collection payload.
  return html
    .replace(/\\u0022/gi, '"')
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/");
}

function moneyObject(text) {
  const amountFirst = text.match(new RegExp(
    `"amount"\\s*:\\s*"?([0-9][0-9.,]*)"?\\s*,\\s*"currency(?:Code)?"\\s*:\\s*"(${CURRENCY_CODES})"`,
    "i",
  ));
  if (amountFirst) return parseRetailMoney(amountFirst[1], amountFirst[2]);
  const currencyFirst = text.match(new RegExp(
    `"currency(?:Code)?"\\s*:\\s*"(${CURRENCY_CODES})"\\s*,\\s*"amount"\\s*:\\s*"?([0-9][0-9.,]*)"?`,
    "i",
  ));
  return currencyFirst ? parseRetailMoney(currencyFirst[2], currencyFirst[1]) : undefined;
}

function pathPart(url, name) {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const index = parts.indexOf(name);
    return index >= 0 ? parts[index + 1] : undefined;
  } catch {
    return undefined;
  }
}

function variantMoney(text, variantId) {
  if (!variantId) return undefined;
  const markers = [`ProductVariant/${variantId}",`, `"id":"${variantId}",`];
  for (const marker of markers) {
    let index = text.indexOf(marker);
    while (index >= 0) {
      const nextVariant = text.indexOf("ProductVariant/", index + marker.length);
      const end = nextVariant >= 0 ? Math.min(nextVariant, index + 8_000) : index + 8_000;
      const priceMarker = text.indexOf('"price":{', index);
      if (priceMarker >= 0 && priceMarker < end) {
        const price = moneyObject(text.slice(priceMarker, priceMarker + 300));
        if (price) return price;
      }
      index = text.indexOf(marker, index + marker.length);
    }
  }
  return undefined;
}

function productMoney(text, handle) {
  if (!handle) return undefined;
  const marker = `"handle":"${handle}"`;
  let index = text.indexOf(marker);
  while (index >= 0) {
    const nextProduct = text.indexOf('},{"id":"gid://shopify/Product/', index + marker.length);
    const end = nextProduct >= 0 ? Math.min(nextProduct, index + 60_000) : index + 60_000;
    const segment = text.slice(index, end);
    const range = segment.indexOf('"minVariantPrice":{');
    if (range >= 0) {
      const price = moneyObject(segment.slice(range, range + 300));
      if (price) return price;
    }
    const variants = segment.indexOf('"variants":{"nodes":[');
    if (variants >= 0) {
      const priceMarker = segment.indexOf('"price":{', variants);
      if (priceMarker >= 0) {
        const price = moneyObject(segment.slice(priceMarker, priceMarker + 300));
        if (price) return price;
      }
    }
    index = text.indexOf(marker, index + marker.length);
  }
  return undefined;
}

function collectionMoney(text, handle) {
  if (!handle) return undefined;
  const expected = searchable(handle);
  let index = text.indexOf('"collection":{');
  while (index >= 0) {
    const segment = text.slice(index, index + 80_000);
    const title = segment.match(/"title"\s*:\s*"([^"]+)"/)?.[1];
    const productVariants = segment.indexOf('"productVariants":[');
    const titleKey = searchable(title ?? "");
    if (
      productVariants >= 0 &&
      titleKey &&
      (titleKey.includes(expected) || expected.includes(titleKey))
    ) {
      const priceMarker = segment.indexOf('"price":{', productVariants);
      if (priceMarker >= 0) {
        const price = moneyObject(segment.slice(priceMarker, priceMarker + 300));
        if (price) return price;
      }
    }
    index = text.indexOf('"collection":{', index + 14);
  }
  return undefined;
}

function embeddedCommerceOffer(html, pageUrl) {
  const text = decodedCommerceText(html);
  const variantId = (() => {
    try { return new URL(pageUrl).searchParams.get("variant") ?? undefined; } catch { return undefined; }
  })();
  const price =
    variantMoney(text, variantId) ??
    productMoney(text, pathPart(pageUrl, "products")) ??
    collectionMoney(text, pathPart(pageUrl, "collections"));
  return price ? { price, source: "embedded-commerce" } : undefined;
}

/**
 * Extract a page-stated retailer ask. Every fallback remains scoped to the
 * requested product handle or current collection; unrelated cards never win.
 */
export function extractRetailOffer(html, pageUrl) {
  const jsonLd = jsonLdOffer(html, pageUrl);
  const meta = metaOffer(html);
  const embedded = embeddedCommerceOffer(html, pageUrl);
  let path = "";
  let hasVariant = false;
  try {
    const parsed = new URL(pageUrl);
    path = parsed.pathname;
    hasVariant = parsed.searchParams.has("variant");
  } catch { /* use standardized sources first */ }
  // Collection analytics and a selected variant are more specific than a
  // generic product-level offer. Ordinary product pages still prefer the
  // standardized JSON-LD/meta paths before the commerce-payload fallback.
  const priced = path.includes("/collections/") || hasVariant
    ? embedded ?? jsonLd ?? meta
    : jsonLd ?? meta ?? embedded;
  const condition = jsonLd?.condition ?? meta?.condition;
  if (!priced && !condition) return undefined;
  return { ...priced, condition: priced?.condition ?? condition };
}

export function offerFailure(url) {
  const collection = pathPart(url, "collections");
  return collection
    ? {
        code: "no-unambiguous-collection-price",
        message: "no price tied to the current collection in Shopify, JSON-LD, price meta, or embedded commerce data",
      }
    : {
        code: "no-priced-product-data",
        message: "no price tied to this product in Shopify, JSON-LD, price meta, or embedded commerce data",
      };
}
