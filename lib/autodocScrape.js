/**
 * Fetch Autodoc listing HTML and extract product-like prices + labels.
 * Autodoc uses Cloudflare; optional Browserless (headless Chrome) avoids blocks.
 */

const axios = require("axios");

const FETCH_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

function isBlockedHtml(html) {
  return (
    /Just a moment|cf-browser-verification|challenge-platform|_cf_chl_opt/i.test(
      html || ""
    ) ||
    ((html?.length ?? 0) < 15000 &&
      !/auto-onderdelen|productnummer|onze prijs/i.test(html || ""))
  );
}

function addProduct(products, seen, { name, priceCents, reference, productId }) {
  if (!priceCents || priceCents < 50 || priceCents > 500000) return;
  const cleanName = name
    ? String(name)
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 160)
    : "";
  const ref = reference ? String(reference).trim().slice(0, 60) : null;
  const id = productId ? String(productId).trim() : null;
  if (priceCents === 200 && !cleanName && !ref && !id) return;
  if (!cleanName && !ref && !id) return;
  const key = `${id || ref || cleanName || "item"}-${priceCents}`;
  if (seen.has(key)) return;
  seen.add(key);
  products.push({
    name: cleanName || ref || id || "Autodoc product",
    brand: null,
    reference: ref,
    priceCents,
    priceFormatted: `€${(priceCents / 100).toFixed(2).replace(".", ",")}`,
    productId: id,
  });
}

function parseAutodocListingHtml(html) {
  if (isBlockedHtml(html)) {
    return { products: [], blocked: true };
  }

  const products = [];
  const seen = new Set();

  const productBlockRe =
    /productnummer[^<]{0,160}[\s\S]{0,800}?onze prijs[^€\d]{0,40}(?:€\s*)?(\d+[,.]\d{2})/gi;
  let blockMatch;
  while ((blockMatch = productBlockRe.exec(html))) {
    const priceCents = Math.round(
      parseFloat(blockMatch[1].replace(",", ".")) * 100
    );
    const before = html.slice(Math.max(0, blockMatch.index - 500), blockMatch.index);
    const titleMatch = before.match(/>([^<]{8,100})<\/[^>]+>\s*$/);
    addProduct(products, seen, {
      name: titleMatch ? titleMatch[1].trim() : null,
      priceCents,
      reference: null,
      productId: null,
    });
  }

  const jsonPatterns = [
    /"brandName"\s*:\s*"([^"]+)"[^}]{0,500}?"articleNo"\s*:\s*"([^"]+)"[^}]{0,500}?"price"\s*:\s*([\d.]+)/gi,
    /"articleNo"\s*:\s*"([^"]+)"[^}]{0,800}?"price"\s*:\s*([\d.]+)/gi,
    /"price"\s*:\s*([\d.]+)[^}]{0,800}?"articleNo"\s*:\s*"([^"]+)"/gi,
    /"articleId"\s*:\s*"?([\w-]+)"?[^}]{0,800}?"price"\s*:\s*([\d.]+)/gi,
  ];

  for (const [idx, re] of jsonPatterns.entries()) {
    let m;
    while ((m = re.exec(html))) {
      if (idx === 0) {
        addProduct(products, seen, {
          name: `${m[1]} ${m[2]}`,
          priceCents: Math.round(parseFloat(m[3]) * 100),
          reference: m[2],
          productId: null,
        });
      } else if (idx === 1) {
        addProduct(products, seen, {
          name: m[1],
          priceCents: Math.round(parseFloat(m[2]) * 100),
          reference: m[1],
          productId: null,
        });
      } else if (idx === 2) {
        addProduct(products, seen, {
          name: m[2],
          priceCents: Math.round(parseFloat(m[1]) * 100),
          reference: m[2],
          productId: null,
        });
      } else {
        addProduct(products, seen, {
          name: null,
          priceCents: Math.round(parseFloat(m[2]) * 100),
          reference: m[1],
          productId: m[1],
        });
      }
    }
  }

  const namedRe =
    /"name"\s*:\s*"([^"]{5,120})"[\s\S]{0,400}?(?:"price"\s*:\s*"([0-9]+,[0-9]{2})"|"price"\s*:\s*([0-9]+\.[0-9]{2})"|data-price(?:-amount)?="([0-9.]+)")/gi;
  let namedMatch;
  while ((namedMatch = namedRe.exec(html))) {
    const raw =
      namedMatch[2] || namedMatch[3] || namedMatch[4];
    const normalized = raw.includes(",") ? raw.replace(",", ".") : raw;
    addProduct(products, seen, {
      name: namedMatch[1],
      priceCents: Math.round(parseFloat(normalized) * 100),
      reference: null,
      productId: null,
    });
  }

  products.sort((a, b) => a.priceCents - b.priceCents);
  return { products, blocked: false };
}

async function fetchViaBrowserless(url) {
  const token =
    process.env.BROWSERLESS_TOKEN || process.env.BROWSERLESS_API_KEY;
  if (!token) return null;

  const base =
    process.env.BROWSERLESS_URL ||
    `https://production-sfo.browserless.io/content`;
  const endpoint = base.includes("?")
    ? `${base}&token=${token}`
    : `${base}?token=${token}`;

  const { data, status } = await axios.post(
    endpoint,
    {
      url,
      gotoOptions: { waitUntil: "networkidle2", timeout: 45000 },
    },
    {
      headers: { "Content-Type": "application/json" },
      responseType: "text",
      timeout: 55000,
      validateStatus: () => true,
    }
  );

  if (status < 200 || status >= 300) {
    throw new Error(`Browserless HTTP ${status}`);
  }

  const html = typeof data === "string" ? data : String(data ?? "");
  return html.length > 500 ? html : null;
}

async function fetchDirect(url) {
  const { data, status } = await axios.get(url, {
    headers: FETCH_HEADERS,
    maxRedirects: 5,
    responseType: "text",
    timeout: 30000,
    validateStatus: () => true,
  });

  if (status < 200 || status >= 300) {
    throw new Error(`Autodoc HTTP ${status}`);
  }
  return data;
}

function validateAutodocUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, message: "Invalid URL" };
  }
  if (!/^https:\/\/(www\.)?autodoc\.nl$/i.test(parsed.origin)) {
    return {
      ok: false,
      message: "URL must be https://www.autodoc.nl (any path)",
    };
  }
  return { ok: true };
}

/**
 * @param {string} url Full listing URL including category + vehicle
 */
async function scrapeAutodocListing(url) {
  const validation = validateAutodocUrl(url);
  if (!validation.ok) {
    return {
      success: false,
      error: "INVALID_URL",
      message: validation.message,
      products: [],
      blocked: false,
    };
  }

  /** @type {string | null} */
  let html = null;
  /** @type {string} */
  let source = "fetch";

  try {
    const browserHtml = await fetchViaBrowserless(url);
    if (browserHtml && browserHtml.length > 1000) {
      html = browserHtml;
      source = "browserless";
    }
  } catch (err) {
    console.warn("Browserless failed, trying direct:", err.message);
  }

  if (!html) {
    try {
      html = await fetchDirect(url);
      source = "fetch";
    } catch (err) {
      return {
        success: false,
        error: "FETCH_FAILED",
        message: err.message || "Failed to fetch Autodoc page",
        products: [],
        blocked: false,
      };
    }
  }

  const { products, blocked } = parseAutodocListingHtml(html);

  const hasBrowserless = !!(
    process.env.BROWSERLESS_TOKEN || process.env.BROWSERLESS_API_KEY
  );

  if (blocked) {
    return {
      success: false,
      error: "CLOUDFLARE_BLOCKED",
      message: hasBrowserless
        ? "Autodoc blocked the scraper (Cloudflare). Check BROWSERLESS_TOKEN / BROWSERLESS_URL."
        : "Autodoc blocked the server (Cloudflare). Set BROWSERLESS_TOKEN for headless fetch.",
      products: [],
      blocked: true,
      source,
    };
  }

  if (!products.length) {
    return {
      success: false,
      error: "NO_PRODUCTS",
      message: "No products parsed from Autodoc HTML.",
      products: [],
      blocked: false,
      source,
    };
  }

  const prices = products.map((p) => p.priceCents);
  return {
    success: true,
    products,
    blocked: false,
    source,
    minCents: Math.min(...prices),
    maxCents: Math.max(...prices),
  };
}

module.exports = {
  scrapeAutodocListing,
  parseAutodocListingHtml,
  validateAutodocUrl,
};
