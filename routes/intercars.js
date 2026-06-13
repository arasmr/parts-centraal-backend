/**
 * InterCars IC API routes — mirrors IC.postman_collection.json
 * baseUrl: https://api.webapi.intercars.eu/ic
 */
const express = require("express");
const { createIcProxy } = require("../lib/intercarsClient");
const { applyIntercarsOrderMetadata } = require("../lib/orderMetadata");
const api = require("../controllers/intercarsApi");

const router = express.Router();

// --- Auth (Postman: Authorize) ---
router.post("/oauth/token", api.oauthToken);
router.get("/oauth/token/status", api.oauthTokenStatus);

// --- Customer ---
router.get("/customer", createIcProxy("GET", "/customer"));
router.get("/customer/finances", createIcProxy("GET", "/customer/finances"));

// --- Inventory ---
router.post("/inventory/quote", api.inventoryQuote);
router.get("/inventory/stock", api.inventoryStockGet);
router.post("/inventory/stock", api.inventoryStockPost);

// --- Pricing ---
router.post("/pricing/quote", api.pricingQuote);

// --- Delivery ---
router.get("/delivery", createIcProxy("GET", "/delivery"));
router.get("/delivery/:id", createIcProxy("GET", (req) => `/delivery/${req.params.id}`));

// --- Invoice ---
router.get("/invoice", createIcProxy("GET", "/invoice"));
router.get("/invoice/detail", api.invoiceById);
router.get("/invoice/:id", createIcProxy("GET", (req) => `/invoice/${req.params.id}`));

// --- Sales ---
router.post(
  "/sales/requisition",
  createIcProxy("POST", "/sales/requisition", {
    normalizeBody: applyIntercarsOrderMetadata,
  }),
);
router.get(
  "/sales/requisition",
  createIcProxy("GET", "/sales/requisition"),
);
router.get(
  "/sales/requisition/:id",
  createIcProxy("GET", (req) => `/sales/requisition/${req.params.id}`),
);
router.post(
  "/sales/requisition/:id/confirm",
  createIcProxy("POST", (req) => `/sales/requisition/${req.params.id}/confirm`),
);
router.post(
  "/sales/requisition/:id/cancel",
  createIcProxy("POST", (req) => `/sales/requisition/${req.params.id}/cancel`),
);
router.get(
  "/sales/order/:id",
  createIcProxy("GET", (req) => `/sales/order/${req.params.id}`),
);

module.exports = router;
