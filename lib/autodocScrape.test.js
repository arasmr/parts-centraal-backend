const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseAutodocListingHtml,
  validateAutodocUrl,
} = require("./autodocScrape");

test("validateAutodocUrl accepts autodoc.nl listing", () => {
  const result = validateAutodocUrl(
    "https://www.autodoc.nl/auto-onderdelen/luchtfilter-10360/toyota/prius/prius-hatchback-nhw20/17711-1-5-hybrid-nhw20"
  );
  assert.equal(result.ok, true);
});

test("validateAutodocUrl rejects other hosts", () => {
  const result = validateAutodocUrl("https://example.com/foo");
  assert.equal(result.ok, false);
});

test("parseAutodocListingHtml extracts embedded JSON products", () => {
  const html = `
    <html><body>auto-onderdelen luchtfilter productnummer
      {"brandName":"Bosch","articleNo":"F 026 400 170","price":10.43}
      {"brandName":"Filtron","articleNo":"AP 170/2","price":9.70}
      onze prijs
    </body></html>
  `.repeat(20);
  const { products, blocked } = parseAutodocListingHtml(html);
  assert.equal(blocked, false);
  assert.ok(products.length >= 2);
  assert.equal(products[0].priceCents, 970);
});

test("parseAutodocListingHtml detects cloudflare challenge", () => {
  const html = "<html><title>Just a moment...</title></html>";
  const { products, blocked } = parseAutodocListingHtml(html);
  assert.equal(blocked, true);
  assert.equal(products.length, 0);
});
