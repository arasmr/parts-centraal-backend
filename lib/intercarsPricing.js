/**
 * InterCars POST /ic/pricing/quote
 * @see https://docs.webapi.intercars.eu/ic-api/contracts/api
 */

function buildPricingQuoteBody(input = {}) {
  const quantity = Number(input.quantity) > 0 ? Number(input.quantity) : 1;
  const location =
    input.location ||
    (process.env.IC_PRICING_LOCATION
      ? process.env.IC_PRICING_LOCATION.split(",").map((s) => s.trim())
      : ["KOM"]);

  const body = { location, lines: [] };

  if (input.shipTo) {
    body.shipTo = String(input.shipTo);
  } else if (process.env.IC_SHIP_TO) {
    body.shipTo = process.env.IC_SHIP_TO;
  }

  if (Array.isArray(input.lines) && input.lines.length > 0) {
    body.lines = input.lines.map((line) => normalizeQuoteLine(line, quantity));
    return body;
  }

  if (input.index) {
    body.lines.push({ index: String(input.index), quantity });
    return body;
  }

  if (input.sku) {
    body.lines.push({ sku: String(input.sku), quantity });
    return body;
  }

  if (Array.isArray(input.skus) && input.skus.length > 0) {
    body.lines = input.skus.map((sku) => ({ sku: String(sku), quantity }));
    return body;
  }

  if (Array.isArray(input.indices) && input.indices.length > 0) {
    body.lines = input.indices.map((index) => ({
      index: String(index),
      quantity,
    }));
    return body;
  }

  // Sandbox sample SKU from InterCars docs
  body.lines.push({ sku: "ADDFFF", quantity: 1 });
  return body;
}

function normalizeQuoteLine(line, defaultQuantity) {
  const quantity =
    Number(line.quantity) > 0 ? Number(line.quantity) : defaultQuantity;

  if (line.sku) {
    return { sku: String(line.sku), quantity };
  }
  if (line.index) {
    return { index: String(line.index), quantity };
  }

  throw new Error("Each pricing line must include sku or index");
}

function buildPricingQuoteBodyFromRequest(req) {
  const fromBody = req.body && typeof req.body === "object" ? req.body : {};
  const fromQuery = req.query && typeof req.query === "object" ? req.query : {};

  return buildPricingQuoteBody({
    ...fromQuery,
    ...fromBody,
    sku: fromBody.sku ?? fromQuery.sku,
    index: fromBody.index ?? fromQuery.index,
    quantity: fromBody.quantity ?? fromQuery.quantity,
    shipTo: fromBody.shipTo ?? fromQuery.shipTo,
    location: fromBody.location ?? fromQuery.location,
    lines: fromBody.lines,
    skus: fromBody.skus,
    indices: fromBody.indices,
  });
}

function sendIntercarsError(res, error, logLabel) {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;
    console.error(`${logLabel}: InterCars ${status}`, data);
    return res.status(status).json({
      error: "InterCars API error",
      intercarsStatus: status,
      intercars: data,
    });
  }

  console.error(`${logLabel}:`, error.message || error);
  return res.status(500).json({
    error: error.message || "Internal Server Error",
  });
}

module.exports = {
  buildPricingQuoteBody,
  buildPricingQuoteBodyFromRequest,
  sendIntercarsError,
};
