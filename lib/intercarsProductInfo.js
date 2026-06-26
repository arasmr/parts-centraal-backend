/**
 * InterCars tow_kod → product info (brand / name / reference).
 *
 * Source: InterCars "ProductInformation" CSV export, trimmed to
 * `<tow_kod>\t<brand>\t<name>\t<reference>` rows. The IC live API
 * (pricing/inventory) is keyed by tow_kod but does NOT return the brand, so
 * this lets us enrich a live lookup with the manufacturer + description.
 *
 * Data is loaded lazily once and cached in-process. Regenerate the gzipped
 * dataset with scripts/build-intercars-reference-index.mjs after a new export.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const DATA_FILE = path.join(
  __dirname,
  "..",
  "data",
  "intercars-product-info.tsv.gz",
);

let infoMap = null;
let loadError = null;

/** Strip everything but A-Z0-9 and uppercase — matches how the dataset is keyed. */
function normalizeTowKod(towKod) {
  return String(towKod || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function ensureLoaded() {
  if (infoMap || loadError) {
    return;
  }
  try {
    const gz = fs.readFileSync(DATA_FILE);
    const tsv = zlib.gunzipSync(gz).toString("utf8");
    const map = new Map();
    const len = tsv.length;
    let start = 0;

    for (let i = 0; i <= len; i += 1) {
      if (i === len || tsv.charCodeAt(i) === 10 /* \n */) {
        if (i > start) {
          const line = tsv.slice(start, i);
          const f1 = line.indexOf("\t");
          if (f1 > 0) {
            const f2 = line.indexOf("\t", f1 + 1);
            const f3 = f2 > 0 ? line.indexOf("\t", f2 + 1) : -1;
            const tow = line.slice(0, f1);
            const brand = f2 > 0 ? line.slice(f1 + 1, f2) : "";
            const name =
              f3 > 0 ? line.slice(f2 + 1, f3) : line.slice(f1 + 1);
            const reference = f3 > 0 ? line.slice(f3 + 1) : "";
            if (!map.has(tow)) {
              map.set(tow, { brand, name, reference });
            }
          }
        }
        start = i + 1;
      }
    }

    infoMap = map;
  } catch (err) {
    loadError = err;
  }
}

/**
 * Resolve InterCars product info for a tow_kod (SKU).
 * @returns {{brand: string, name: string, reference: string} | null}
 */
function resolveProductInfoByTowKod(towKod) {
  ensureLoaded();
  if (loadError) {
    throw loadError;
  }
  const norm = normalizeTowKod(towKod);
  if (!norm) {
    return null;
  }
  return infoMap.get(norm) || null;
}

/** Number of indexed tow_kods (after lazy load). For diagnostics. */
function infoSize() {
  ensureLoaded();
  return infoMap ? infoMap.size : 0;
}

module.exports = {
  normalizeTowKod,
  resolveProductInfoByTowKod,
  ensureLoaded,
  infoSize,
};
