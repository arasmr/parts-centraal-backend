const {
  icRequest,
  forwardStatus,
  requestOAuthToken,
} = require("../lib/intercarsClient");
const {
  buildPricingQuoteBodyFromRequest,
  sendIntercarsError,
} = require("../lib/intercarsPricing");
const {
  resolveTowKodsByReference,
} = require("../lib/intercarsReferenceIndex");
const {
  resolveProductInfoByTowKod,
} = require("../lib/intercarsProductInfo");

/** POST /inventory/quote — availability + price per warehouse */
async function inventoryQuote(req, res) {
  try {
    const body = buildPricingQuoteBodyFromRequest(req);
    const icResponse = await icRequest({
      method: "post",
      path: "/inventory/quote",
      params: req.query,
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    return forwardStatus(res, icResponse);
  } catch (error) {
    return sendIntercarsError(res, error, "inventoryQuote");
  }
}

/** POST /pricing/quote — item price calculation */
async function pricingQuote(req, res) {
  try {
    const body = buildPricingQuoteBodyFromRequest(req);
    const icResponse = await icRequest({
      method: "post",
      path: "/pricing/quote",
      params: req.query,
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    return forwardStatus(res, icResponse);
  } catch (error) {
    return sendIntercarsError(res, error, "pricingQuote");
  }
}

/** GET /inventory/stock?sku=ADDFFF&location=KOM */
async function inventoryStockGet(req, res) {
  try {
    const icResponse = await icRequest({
      method: "get",
      path: "/inventory/stock",
      params: req.query,
    });
    console.log("inventoryStockGet response:", {
      status: icResponse.status,
      data: icResponse.data,
    });
    return forwardStatus(res, icResponse);
  } catch (error) {
    return sendIntercarsError(res, error, "inventoryStockGet");
  }
}

/** POST /inventory/stock?location=KOM — body: { sku: "ADDFFF,ADDFA" } */
async function inventoryStockPost(req, res) {
  try {
    const icResponse = await icRequest({
      method: "post",
      path: "/inventory/stock",
      params: req.query,
      data: req.body,
      headers: { "Content-Type": "application/json" },
    });
    return forwardStatus(res, icResponse);
  } catch (error) {
    return sendIntercarsError(res, error, "inventoryStockPost");
  }
}

/** POST /oauth/token — same as Postman "Authorize" (client credentials) */
async function oauthToken(req, res) {
  try {
    const icResponse = await requestOAuthToken();
    if (icResponse.status >= 400) {
      return res.status(icResponse.status).json({
        error: "InterCars OAuth failed",
        intercars: icResponse.data,
      });
    }
    return res.json(icResponse.data);
  } catch (error) {
    return sendIntercarsError(res, error, "oauthToken");
  }
}

/**
 * GET /invoice/detail?id=LAZ/19/0001&techId=true
 * Invoice IDs often contain slashes; query param avoids nginx/Express path 404s.
 */
async function invoiceById(req, res) {
  try {
    const id = req.query.id;
    if (!id || !String(id).trim()) {
      return res.status(400).json({
        error: "Query parameter id is required (InterCars invoice id)",
      });
    }

    const params = {};
    if (req.query.techId === "true" || req.query.techId === "1") {
      params.techId = "true";
    }

    const encoded = encodeURIComponent(String(id).trim());
    const icResponse = await icRequest({
      method: "get",
      path: `/invoice/${encoded}`,
      params,
    });
    return forwardStatus(res, icResponse);
  } catch (error) {
    return sendIntercarsError(res, error, "invoiceById");
  }
}

/**
 * GET /sku-by-reference?reference=ADH22118
 * Resolves InterCars tow_kod(s) for a manufacturer / TecDoc reference using the
 * bundled ProductInformation index. tow_kod is the SKU used by pricing/inventory.
 */
function skuByReference(req, res) {
  const reference = req.query.reference;
  if (!reference || !String(reference).trim()) {
    return res.status(400).json({
      data: {
        success: false,
        error: "MISSING_REFERENCE",
        message: "Query parameter ?reference= is required",
      },
    });
  }

  try {
    const towKods = resolveTowKodsByReference(reference);
    return res.json({
      data: {
        success: true,
        reference: String(reference).trim(),
        towKods,
        matches: towKods.map((towKod) => ({ towKod })),
      },
    });
  } catch (error) {
    return res.status(500).json({
      data: {
        success: false,
        error: "INDEX_ERROR",
        message: error.message || "Failed to read InterCars reference index",
      },
    });
  }
}

/**
 * GET /product-info?sku=BADE08[,F61F56]
 * Returns brand / name / reference for one or more tow_kod(s) from the bundled
 * ProductInformation index. The IC live API does not expose the brand, so this
 * enriches a SKU lookup with the manufacturer + description.
 */
function productInfoBySku(req, res) {
  const raw = req.query.sku;
  if (!raw || !String(raw).trim()) {
    return res.status(400).json({
      data: {
        success: false,
        error: "MISSING_SKU",
        message: "Query parameter ?sku= is required",
      },
    });
  }

  const skus = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const items = skus.map((sku) => {
      const info = resolveProductInfoByTowKod(sku);
      return {
        sku,
        brand: info?.brand || null,
        name: info?.name || null,
        reference: info?.reference || null,
      };
    });
    return res.json({
      data: {
        success: true,
        items,
      },
    });
  } catch (error) {
    return res.status(500).json({
      data: {
        success: false,
        error: "INDEX_ERROR",
        message: error.message || "Failed to read InterCars product info index",
      },
    });
  }
}

/** GET /oauth/token/status — cached token probe (no secret in response) */
async function oauthTokenStatus(req, res) {
  try {
    const {
      getBearerToken,
      IC_API_BASE_URL,
    } = require("../lib/intercarsClient");
    const token = await getBearerToken();
    res.json({
      ok: Boolean(token),
      tokenPreview: token ? `${token.slice(0, 12)}…` : null,
      baseUrl: IC_API_BASE_URL,
    });
  } catch (error) {
    return sendIntercarsError(res, error, "oauthTokenStatus");
  }
}

module.exports = {
  inventoryQuote,
  pricingQuote,
  inventoryStockGet,
  inventoryStockPost,
  invoiceById,
  oauthToken,
  oauthTokenStatus,
  skuByReference,
  productInfoBySku,
};
