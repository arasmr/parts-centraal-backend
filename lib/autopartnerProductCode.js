/**
 * AutoPartner product codes for motor oils use ~ in shop product_id (tow_kod).
 * AP ProductsAvailability / InsertOrder expect the spaced index name
 * (e.g. "5W40 MAGN DUAL C3 1L" instead of "5W40~MAGN~DUAL~C3~1L").
 */

function stripAutopartnerProductIdPrefix(value) {
  const trimmed = String(value ?? "").trim();
  if (trimmed.startsWith("002")) {
    return trimmed.slice(3).trim();
  }
  return trimmed;
}

function decodeAutopartnerTowKod(towKod) {
  return String(towKod ?? "")
    .replace(/~/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactAutopartnerProductCode(code) {
  return String(code ?? "")
    .replace(/~/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

/**
 * Best code to send to AutoPartner API for a tow_kod or internal product_id.
 */
function normalizeAutopartnerProductCode(value) {
  const towKod = stripAutopartnerProductIdPrefix(value);
  if (!towKod) {
    return "";
  }
  if (towKod.includes("~")) {
    return decodeAutopartnerTowKod(towKod);
  }
  return towKod;
}

function normalizeAutopartnerProductCodes(values) {
  if (!Array.isArray(values)) {
    const single = normalizeAutopartnerProductCode(values);
    return single ? [single] : [];
  }

  const seen = new Set();
  const normalized = [];
  for (const value of values) {
    const code = normalizeAutopartnerProductCode(value);
    if (!code) {
      continue;
    }
    const key = code.toUpperCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(code);
  }
  return normalized;
}

module.exports = {
  stripAutopartnerProductIdPrefix,
  decodeAutopartnerTowKod,
  compactAutopartnerProductCode,
  normalizeAutopartnerProductCode,
  normalizeAutopartnerProductCodes,
};
