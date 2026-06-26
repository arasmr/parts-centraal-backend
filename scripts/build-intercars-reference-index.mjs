#!/usr/bin/env node
/**
 * Build InterCars lookup datasets from a ProductInformation CSV.
 *
 * The InterCars "ProductInformation" export is ~165 MB / 700k+ rows. This trims
 * it into two gzipped datasets:
 *   1. data/intercars-reference-index.tsv.gz
 *      `<normalized reference>\t<tow_kod>` pairs (keyed on ARTICLE_NUMBER,
 *      IC_INDEX and TEC_DOC so any of them resolves the SKU).
 *   2. data/intercars-product-info.tsv.gz
 *      `<tow_kod>\t<brand>\t<name>\t<reference>` (one row per tow_kod) so the
 *      live SKU lookup can be enriched with brand + description.
 *
 * Usage:
 *   node scripts/build-intercars-reference-index.mjs <path-to-ProductInformation.csv>
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(__dirname, "..", "data", "intercars-reference-index.tsv.gz");
const OUTPUT_INFO = path.join(
  __dirname,
  "..",
  "data",
  "intercars-product-info.tsv.gz",
);

const inputPath = process.argv[2];
if (!inputPath) {
  console.error(
    "Usage: node scripts/build-intercars-reference-index.mjs <ProductInformation.csv>",
  );
  process.exit(1);
}
if (!fs.existsSync(inputPath)) {
  console.error(`Input CSV not found: ${inputPath}`);
  process.exit(1);
}

const normalize = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

// Free text (brand / description): keep human-readable, just strip tabs/newlines.
const cleanText = (value) =>
  String(value || "")
    .replace(/[\t\r\n]+/g, " ")
    .trim();

const rl = readline.createInterface({
  input: fs.createReadStream(inputPath),
  crlfDelay: Infinity,
});

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

const gzip = zlib.createGzip({ level: 9 });
const out = fs.createWriteStream(OUTPUT);
gzip.pipe(out);

const gzipInfo = zlib.createGzip({ level: 9 });
const outInfo = fs.createWriteStream(OUTPUT_INFO);
gzipInfo.pipe(outInfo);

let header = null;
let cols = {};
let rows = 0;
let pairs = 0;
let infoRows = 0;
const seen = new Set();
const seenTow = new Set();

function writePair(ref, tow) {
  if (!ref || !tow) return;
  const key = `${ref}\t${tow}`;
  if (seen.has(key)) return;
  seen.add(key);
  if (!gzip.write(`${ref}\t${tow}\n`)) {
    // backpressure handled by Node stream buffering; fine for a one-off build.
  }
  pairs += 1;
}

function writeInfo(tow, brand, name, reference) {
  if (!tow || seenTow.has(tow)) return;
  seenTow.add(tow);
  gzipInfo.write(`${tow}\t${brand}\t${name}\t${reference}\n`);
  infoRows += 1;
}

rl.on("line", (line) => {
  const parts = line.split(";");
  if (!header) {
    header = parts.map((h) => h.trim().toUpperCase());
    cols = {
      tow: header.indexOf("TOW_KOD"),
      idx: header.indexOf("IC_INDEX"),
      tec: header.indexOf("TEC_DOC"),
      art: header.indexOf("ARTICLE_NUMBER"),
      mfr: header.indexOf("MANUFACTURER"),
      short: header.indexOf("SHORT_DESCRIPTION"),
    };
    if (cols.tow === -1) {
      console.error("CSV missing TOW_KOD column");
      process.exit(1);
    }
    return;
  }

  rows += 1;
  const tow = normalize(parts[cols.tow]);
  if (!tow) return;

  const art = cols.art >= 0 ? normalize(parts[cols.art]) : "";
  const idx = cols.idx >= 0 ? normalize(parts[cols.idx]) : "";
  const tec = cols.tec >= 0 ? normalize(parts[cols.tec]) : "";

  if (art) writePair(art, tow);
  if (idx && idx !== art) writePair(idx, tow);
  if (tec && tec !== art && tec !== idx) writePair(tec, tow);

  const brand = cols.mfr >= 0 ? cleanText(parts[cols.mfr]) : "";
  const name = cols.short >= 0 ? cleanText(parts[cols.short]) : "";
  const reference = cols.idx >= 0 ? cleanText(parts[cols.idx]) : "";
  if (brand || name || reference) {
    writeInfo(tow, brand, name, reference);
  }
});

rl.on("close", () => {
  gzip.end();
  gzipInfo.end();
  let pending = 2;
  const done = () => {
    pending -= 1;
    if (pending === 0) {
      console.log(
        `Done. ${rows} rows → ${pairs} reference/tow_kod pairs → ${OUTPUT}\n` +
          `      ${infoRows} tow_kod info rows → ${OUTPUT_INFO}`,
      );
    }
  };
  out.on("close", done);
  outInfo.on("close", done);
});
