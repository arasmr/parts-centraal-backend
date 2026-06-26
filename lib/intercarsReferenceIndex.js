/**
 * InterCars reference → tow_kod index.
 *
 * Source: InterCars "ProductInformation" CSV export, trimmed to
 * `<normalized reference>\t<tow_kod>` pairs (manufacturer/article keys folded in).
 * The IC live API (pricing/inventory) is keyed by tow_kod, so this lets us
 * resolve an InterCars SKU from a manufacturer / TecDoc reference.
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
  "intercars-reference-index.tsv.gz",
);

/** Separator used to pack multiple tow_kods under one reference key. */
const MULTI = "\u001f";

let indexMap = null;
let loadError = null;

/** Strip everything but A-Z0-9 and uppercase — matches how the dataset is keyed. */
function normalizeReference(reference) {
  return String(reference || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function ensureLoaded() {
  if (indexMap || loadError) {
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
          const tab = tsv.indexOf("\t", start);
          if (tab > start && tab < i) {
            const ref = tsv.slice(start, tab);
            const towKod = tsv.slice(tab + 1, i);
            const existing = map.get(ref);
            if (existing === undefined) {
              map.set(ref, towKod);
            } else if (existing.indexOf(towKod) === -1) {
              map.set(ref, existing + MULTI + towKod);
            }
          }
        }
        start = i + 1;
      }
    }

    indexMap = map;
  } catch (err) {
    loadError = err;
  }
}

/**
 * Resolve InterCars tow_kods for a manufacturer / TecDoc reference.
 * @returns {string[]} matching tow_kods (empty when not found).
 */
function resolveTowKodsByReference(reference) {
  ensureLoaded();
  if (loadError) {
    throw loadError;
  }
  const norm = normalizeReference(reference);
  if (!norm) {
    return [];
  }
  const packed = indexMap.get(norm);
  return packed ? packed.split(MULTI) : [];
}

/** Number of indexed references (after lazy load). For diagnostics. */
function indexSize() {
  ensureLoaded();
  return indexMap ? indexMap.size : 0;
}

module.exports = {
  normalizeReference,
  resolveTowKodsByReference,
  ensureLoaded,
  indexSize,
};
