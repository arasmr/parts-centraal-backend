const express = require("express");
const intercars = require("../controllers/intercars");
const intercarsIcRouter = require("./intercars");
const autopartnerRouter = require("./autopartner");
const intercarsApi = require("../controllers/intercarsApi");
const { createIcProxy } = require("../lib/intercarsClient");

const router = express.Router();

/** Full IC API (matches Postman collection paths under /intercars/ic) */
router.use("/intercars/ic", intercarsIcRouter);

/** AutoPartner CustomerAPI (SOAP/REST JSON) */
router.use("/autopartner", autopartnerRouter);

/** Legacy shortcuts → same handlers as /intercars/ic/... */
router.post("/intercars/pricing/quote", intercarsApi.pricingQuote);
router.post("/intercars/inventory/quote", intercarsApi.inventoryQuote);
router.get("/intercars/inventory/stock", intercarsApi.inventoryStockGet);
router.post("/intercars/inventory/stock", intercarsApi.inventoryStockPost);
router.get("/intercars/customer", createIcProxy("GET", "/customer"));
router.get("/intercars/customer/finances", createIcProxy("GET", "/customer/finances"));
router.post("/intercars/orders/submit", createIcProxy("POST", "/sales/requisition"));
router.post("/intercars/oauth/token", intercarsApi.oauthToken);

/** parts-centraal-services routes */
router.get("/getProductsByCategory", intercars.getProductsByCategory);
router.post("/getProductsByCategory", intercars.getProductsByCategory);
router.post("/updateProductsByTecDocId", intercars.updateProductsByTecDocId);
router.post("/createCsvFiles", intercars.createCsvFiles);

module.exports = router;
